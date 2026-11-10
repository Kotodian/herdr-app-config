"""Read-only TAPD panel; reuses the existing Keychain credential without extra packages."""
import base64
import os
import subprocess
import urllib.parse
import urllib.request
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

class PanelError(Exception): pass

class PlainDescription(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts=[]; self.hidden=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style'):self.hidden+=1
        if tag in ('p','div','br','li','tr','h1','h2','h3') and not self.hidden:self.parts.append('\n')
        if tag=='img' and not self.hidden:self.parts.append('[附件图片]')
    def handle_endtag(self,tag):
        if tag in ('script','style') and self.hidden:self.hidden-=1
        if tag in ('p','div','li','tr') and not self.hidden:self.parts.append('\n')
    def handle_data(self,data):
        if not self.hidden:self.parts.append(data)

def description(value):
    if not re.search(r'<[a-zA-Z][^>]*>',value):return value
    parser=PlainDescription();parser.feed(value)
    return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+','\n\n',''.join(parser.parts)).strip()

def unwrap(result):
    if not isinstance(result,dict) or result.get('status')!=1:
        raise PanelError('TAPD 返回错误，请检查项目访问权限后刷新')
    return result.get('data')

def project_list(client):
    data=unwrap(client.get_user_participant_projects({'nick':client.nick}))
    if not isinstance(data,list):raise PanelError('项目列表格式不匹配')
    return [{'id':str(w['id']),'name':w['name']} for item in data
        if (w:=item.get('Workspace',{})).get('category')=='project' and w.get('status')=='normal']

def safe_bug(raw,project,statuses,last,detail=False):
    fields=('id','title','status','priority','priority_label','severity','current_owner','reporter','created','modified','deadline','module','resolution')
    out={k:raw.get(k) for k in fields}
    out['workspace_id']=project['id'];out['project']=project['name']
    out['status_label']=statuses.get(str(raw.get('status')),str(raw.get('status') or '未知'))
    out['closed']=str(raw.get('status')) in last
    out['url']=f"https://www.tapd.cn/{project['id']}/bugtrace/bugs/view/{raw['id']}"
    if detail:out['description']=description(str(raw.get('description') or ''))
    return out

def status_info(client,ws):
    labels=unwrap(client.get_workflows_status_map({'workspace_id':ws,'system':'bug'}))
    last=unwrap(client.get_workflows_last_steps({'workspace_id':ws,'system':'bug'}))
    if not isinstance(labels,dict) or not isinstance(last,dict):raise PanelError('缺陷工作流格式不匹配')
    return labels,set(last)

def dispatch(client,args):
    # Identity must come from the authenticated account. Never fall back to unfiltered queries.
    if not client.nick:raise PanelError('无法确认当前 TAPD 账号，已停止查询，避免显示其他人的缺陷')
    projects=project_list(client)
    if args.get('action')=='detail':
        ws=str(args.get('workspace',''));rid=str(args.get('id',''))
        project=next((p for p in projects if p['id']==ws),None)
        if not project or not re.fullmatch(r'\d{10,30}',rid):raise PanelError('缺陷或项目 ID 无效')
        labels,last=status_info(client,ws)
        rows=unwrap(client.get_bug({'workspace_id':ws,'id':rid,'current_owner':client.nick,'limit':1}))
        if not rows:raise PanelError('此缺陷已不再分配给你，或无权访问，请刷新列表')
        return safe_bug(rows[0]['Bug'],project,labels,last,True)
    if args.get('action')!='snapshot':raise PanelError('仅支持只读缺陷查询')
    all_bugs=[];errors=[]
    for project in projects:
        try:
            labels,last=status_info(client,project['id'])
            rows=[]
            for page in range(1,1001):
                data=unwrap(client.get_bug({'workspace_id':project['id'],'current_owner':client.nick,'page':page,'limit':100,'order':'modified desc'}))
                if not isinstance(data,list):raise PanelError('缺陷列表格式不匹配')
                rows.extend(data)
                if len(data)<100:break
            else:raise PanelError('缺陷数量超出分页限制')
            all_bugs.extend(safe_bug(item['Bug'],project,labels,last) for item in rows)
        except Exception:
            errors.append({'project':project['name'],'message':'此项目读取失败，请检查连接与权限后刷新'})
    # Any failing project stays visible as an error, never masquerades as a complete empty list.
    all_bugs.sort(key=lambda b:str(b.get('modified') or ''),reverse=True)
    return {'user':client.nick,'projects':projects,'bugs':all_bugs,'errors':errors}

class ReadOnlyClient:
    def __init__(self):
        token=os.getenv('TAPD_ACCESS_TOKEN')
        user=os.getenv('TAPD_API_USER');password=os.getenv('TAPD_API_PASSWORD')
        if not token and not (user and password):
            result=subprocess.run(['/usr/bin/security','find-generic-password','-s','codex.tapd.access_token','-a','default','-w'],capture_output=True,text=True,timeout=10)
            if result.returncode==0:token=result.stdout.strip()
        if token:self.authorization='Bearer '+token
        elif user and password:self.authorization='Basic '+base64.b64encode((user+':'+password).encode()).decode()
        else:raise PanelError('未找到现有 TAPD 凭据，请在本机配置 TAPD 连接')
        self.nick=unwrap(self.get('users/info',{})).get('nick')
    def get(self,path,args):
        query=urllib.parse.urlencode({**args,'s':'mcp'})
        req=urllib.request.Request('https://api.tapd.cn/'+path+'?'+query,headers={'Authorization':self.authorization,'Content-Type':'application/json','Via':'mcp'})
        # Never forward an Authorization header to a redirected host.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args,**kwargs):raise PanelError('TAPD 返回重定向，已停止请求')
        with urllib.request.build_opener(NoRedirect).open(req,timeout=25) as r:return json.load(r)
    def get_user_participant_projects(self,args):return self.get('workspaces/user_participant_projects',args)
    def get_workflows_status_map(self,args):return self.get('workflows/status_map',args)
    def get_workflows_last_steps(self,args):return self.get('workflows/last_steps',args)
    def get_bug(self,args):return self.get('bugs',args)

def client():return ReadOnlyClient()

if __name__=='__main__':
    try:result={'ok':True,'data':dispatch(client(),json.loads(sys.argv[1]))}
    except PanelError as e:result={'ok':False,'error':str(e)}
    except Exception:result={'ok':False,'error':'TAPD 连接失败，请检查现有钥匙串授权、网络和项目权限'}
    print(json.dumps(result,ensure_ascii=False))
