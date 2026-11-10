"""Native Herdr DNS bridge. Reads Magpie's existing token on each invocation."""
import hashlib
import ipaddress
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = 'https://api.cloudflare.com/client/v4'
TYPES = {'A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'}

class BridgeError(Exception):
    pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise BridgeError('Cloudflare 返回重定向，已停止请求')

def token():
    try:
        data = json.loads((Path.home()/'.config/magpie/library.json').read_text())
        value = next(s for s in data['mcp'] if s['name'] == 'cloudflare-mcp-pro')['env']['CLOUDFLARE_API_TOKEN']
        if not isinstance(value, str) or not value.strip():
            raise ValueError()
        return value.strip()
    except Exception:
        raise BridgeError('无法读取 Magpie 中的 Cloudflare API Token，请检查现有连接配置') from None

def api(method, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(ROOT+path, data=body, method=method,
        headers={'Authorization': 'Bearer '+token(), 'Content-Type': 'application/json', 'User-Agent': 'Herdr-Cloudflare/1.0'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=18) as response:
            result = json.load(response)
    except urllib.error.HTTPError as e:
        # Never echo a request, authorization header, or remote error body.
        codes = []
        try:
            codes = [str(x.get('code')) for x in json.load(e).get('errors', [])]
        except Exception:
            pass
        raise BridgeError(f'Cloudflare HTTP {e.code}（错误码 {", ".join(codes) or "未知"}）') from None
    except (OSError, ValueError):
        raise BridgeError('网络请求失败；如刚才正在保存，请刷新确认结果后再操作') from None
    if not result.get('success'):
        raise BridgeError('Cloudflare 拒绝请求，请检查记录格式和 Token 权限')
    return result

def identifier(value):
    if not isinstance(value, str) or not re.fullmatch('[a-f0-9]{32}', value):
        raise BridgeError('无效的 Cloudflare ID')
    return value

def fingerprint(record):
    return hashlib.sha256(json.dumps(record, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def record_view(record):
    fields = ('id', 'type', 'name', 'content', 'ttl', 'proxied', 'proxiable', 'priority', 'modified_on', 'comment', 'data')
    return {**{k: record[k] for k in fields if k in record}, 'version': fingerprint(record)}

def paginate(path):
    rows = []
    for page in range(1, 1001):
        result = api('GET', path+'?'+urllib.parse.urlencode({'page':page, 'per_page':100}))
        rows.extend(result['result'])
        if page >= result.get('result_info', {}).get('total_pages', 1):
            return rows
    raise BridgeError('记录分页超出限制，未返回不完整列表')

def domain(value):
    try:
        value = value.rstrip('.').encode('idna').decode('ascii').lower()
    except (UnicodeError, AttributeError):
        raise BridgeError('域名格式无效') from None
    if not value or len(value)>253 or any(not re.fullmatch(r'[a-z0-9_*](?:[a-z0-9_*-]{0,61}[a-z0-9_*])?', label) for label in value.split('.')):
        raise BridgeError('域名格式无效')
    return value

def payload(raw, zone):
    kind = raw.get('type')
    if kind not in TYPES:
        raise BridgeError('此记录类型暂仅支持查看')
    name = str(raw.get('name', '')).strip()
    zone = domain(zone)
    if name == '@':
        name = zone
    elif '.' not in name.rstrip('.'):
        name += '.'+zone
    name = domain(name)
    if name != zone and not name.endswith('.'+zone):
        raise BridgeError('记录名称必须属于当前域名；子域名请填完整名称')
    content = str(raw.get('content', ''))
    if kind != 'TXT':
        content = content.strip()
    if not content or len(content)>65535:
        raise BridgeError('请填写有效的记录内容')
    try:
        if kind in ('A', 'AAAA') and ipaddress.ip_address(content).version != (4 if kind == 'A' else 6):
            raise ValueError()
    except ValueError:
        raise BridgeError('IP 地址与记录类型不匹配') from None
    if kind in ('CNAME', 'MX', 'NS'):
        content = domain(content)
    try:
        ttl = int(raw.get('ttl', 1))
        if ttl != 1 and not 60 <= ttl <= 86400:
            raise ValueError()
    except (ValueError, TypeError):
        raise BridgeError('TTL 应为 1（自动）或 60–86400 秒') from None
    proxy = raw.get('proxied', False)
    if not isinstance(proxy, bool):
        raise BridgeError('代理状态无效')
    proxy = proxy and kind in ('A','AAAA','CNAME')
    result = {'type':kind, 'name':name, 'content':content, 'ttl':1 if proxy else ttl, 'proxied':proxy}
    if kind == 'MX':
        try:
            priority = int(raw.get('priority', 0))
            if not 0 <= priority <= 65535:
                raise ValueError()
        except (ValueError, TypeError):
            raise BridgeError('MX 优先级应为 0–65535') from None
        result['priority'] = priority
    return result

def dispatch(args):
    action = args.get('action')
    if action == 'zones':
        return [{'id':z['id'], 'name':z['name'], 'status':z.get('status')} for z in paginate('/zones')]
    zone = identifier(args.get('zone'))
    path = '/zones/'+zone+'/dns_records'
    if action == 'records':
        return [record_view(r) for r in paginate(path)]
    if action == 'save':
        # Fetch actual zone, never rely on a UI supplied name for validation.
        z = api('GET', '/zones/'+zone)['result']
        data = payload(args.get('record',{}), z['name'])
        rid = args.get('id')
        if rid:
            path += '/'+identifier(rid)
            previous = api('GET', path)['result']
            if fingerprint(previous) != args.get('version'):
                raise BridgeError('此记录已在其他地方更新，请刷新列表后重新编辑')
            if previous['type'] != data['type']:
                raise BridgeError('编辑时请保留记录类型')
            # PATCH keeps comments, tags and type-specific fields untouched.
        result = api('PATCH' if rid else 'POST', path, data)['result']
        return record_view(result)
    raise BridgeError('不支持的操作')

if __name__ == '__main__':
    try:
        result = {'ok':True, 'data':dispatch(json.loads(sys.argv[1]))}
    except BridgeError as e:
        result = {'ok':False, 'error':str(e)}
    except Exception:
        result = {'ok':False, 'error':'Cloudflare 数据读取失败，请检查配置或稍后刷新'}
    print(json.dumps(result, ensure_ascii=False))
