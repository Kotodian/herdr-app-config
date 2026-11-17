"""TAPD panel bridge; reads credentials locally and writes only explicit Bug updates."""
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

def members(client,ws):
    data=unwrap(client.get_workspace_users({'workspace_id':ws,'fields':'user,name'}))
    if not isinstance(data,list):raise PanelError('项目成员列表格式不匹配')
    out={}
    for item in data:
        user=item.get('UserWorkspace',{})
        nick=user.get('user')
        if isinstance(nick,str) and nick:
            out[nick]={'user':nick,'name':str(user.get('name') or nick)}
    return sorted(out.values(),key=lambda x:x['user'].casefold())

def bug(client,ws,rid):
    data=unwrap(client.get_bug({'workspace_id':ws,'id':rid,'limit':1}))
    raw=data[0].get('Bug',{}) if isinstance(data,list) and data else {}
    if str(raw.get('id'))!=rid:raise PanelError('缺陷不存在或没有访问权限，请刷新列表')
    return raw

def transitions(client,ws,status):
    data=unwrap(client.get_workflows_all_transitions({'workspace_id':ws,'system':'bug'}))
    if isinstance(data,dict) and 'StepNext' in data:data=[data]
    elif isinstance(data,dict):data=list(data.values())
    if not isinstance(data,list):raise PanelError('工作流流转规则格式不匹配')
    return [x for x in data if isinstance(x,dict) and x.get('StepPrevious')==status and x.get('StepNext')]

def required_fields(transition,raw):
    out=[]
    for f in transition.get('Appendfield',[]) or []:
        name=f.get('FieldName','')
        if f.get('Notnull')!='yes' or name in ('current_owner','status'):continue
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,100}',name):continue
        value=raw.get(name) or ''
        for default in f.get('DefaultValue',[]) or []:
            if default.get('Type')=='record_value':value=raw.get(str(default.get('Field') or '').rstrip(',')) or value
            elif default.get('Type')=='default_value':value=default.get('Value') or value
        out.append({'name':name,'label':str(f.get('FieldLabel') or name),'value':str(value)})
    return out

def dispatch(client,args):
    if not client.nick:raise PanelError('无法确认当前 TAPD 账号，已停止查询，避免显示其他人的缺陷')
    projects=project_list(client)
    action=args.get('action')
    if action in ('detail','options','update'):
        ws=str(args.get('workspace',''));rid=str(args.get('id',''))
        project=next((p for p in projects if p['id']==ws),None)
        if not project or not re.fullmatch(r'\d{10,30}',rid):raise PanelError('缺陷或项目 ID 无效')
        raw=bug(client,ws,rid)
        labels,last=status_info(client,ws)
        if action=='detail':return safe_bug(raw,project,labels,last,True)
        users=members(client,ws)
        rules=[x for x in transitions(client,ws,raw.get('status')) if x['StepNext'] in labels]
        if action=='options':
            return {'users':users,'statuses':[{'key':raw.get('status'),'label':labels.get(raw.get('status'),raw.get('status')),'fields':[]},
                *[{'key':x['StepNext'],'label':labels.get(x['StepNext'],x['StepNext']),'fields':required_fields(x,raw)} for x in rules if x['StepNext']!=raw.get('status')]]}
        expected=args.get('expected')
        if not isinstance(expected,dict) or any(str(raw.get(k) or '')!=str(expected.get(k) or '') for k in ('modified','status','current_owner')):
            raise PanelError('Bug 已被其他人更新，请刷新详情后重新修改')
        changes=args.get('changes')
        if not isinstance(changes,dict) or not changes or set(changes)-{'current_owner','status','fields'}:
            raise PanelError('请选择处理人或目标状态')
        payload={'workspace_id':ws,'id':rid,'current_user':client.nick}
        if 'current_owner' in changes:
            owner=changes['current_owner']
            if owner not in {x['user'] for x in users}:raise PanelError('请选择此项目的有效处理人')
            payload['current_owner']=owner+';'
        else:payload['current_owner']=raw.get('current_owner') or ''
        if 'status' in changes and changes['status']!=raw.get('status'):
            rule=next((x for x in rules if x['StepNext']==changes['status']),None)
            if not rule:raise PanelError('当前状态不能流转到所选状态，请刷新')
            payload['status']=changes['status']
            supplied=changes.get('fields') or {}
            if not isinstance(supplied,dict):raise PanelError('流转字段格式无效')
            for field in required_fields(rule,raw):
                value=supplied.get(field['name'],field['value'])
                if not isinstance(value,str) or not value.strip():raise PanelError('请补充流转必填字段：'+field['name'])
                payload[field['name']]=value
        if not ({'current_owner','status'} & payload.keys()):raise PanelError('没有需要保存的修改')
        result=unwrap(client.update_bug(payload))
        saved=result.get('Bug',{}) if isinstance(result,dict) else {}
        if str(saved.get('id'))!=rid:raise PanelError('提交后返回异常，请刷新确认结果再操作')
        return safe_bug(saved,project,labels,last,True)
    if action!='snapshot':raise PanelError('不支持的 TAPD 操作')
    owner=str(args.get('owner') or client.nick)
    all_bugs=[];errors=[];users={client.nick:{'user':client.nick,'name':client.nick}};matched=False
    for project in projects:
        try:
            project_users=members(client,project['id'])
            for user in project_users:users[user['user']]=user
            if owner!=client.nick and owner not in {x['user'] for x in project_users}:continue
            matched=True
            labels,last=status_info(client,project['id'])
            rows=[]
            for page in range(1,1001):
                data=unwrap(client.get_bug({'workspace_id':project['id'],'current_owner':owner,'page':page,'limit':100,'order':'modified desc'}))
                if not isinstance(data,list):raise PanelError('缺陷列表格式不匹配')
                rows.extend(data)
                if len(data)<100:break
            else:raise PanelError('缺陷数量超出分页限制')
            # TAPD supports fuzzy owner queries; keep exact owner membership in the UI.
            all_bugs.extend(safe_bug(item['Bug'],project,labels,last) for item in rows
                if owner in str(item.get('Bug',{}).get('current_owner') or '').rstrip(';').split(';'))
        except Exception:
            errors.append({'project':project['name'],'message':'此项目读取失败，请检查连接与权限后刷新'})
    # Any failing project stays visible as an error, never masquerades as a complete empty list.
    all_bugs.sort(key=lambda b:str(b.get('modified') or ''),reverse=True)
    if not matched and not errors and owner!=client.nick:raise PanelError('所选处理人不在可访问项目中，请刷新成员列表')
    return {'user':client.nick,'owner':owner,'users':sorted(users.values(),key=lambda x:x['user'].casefold()),'projects':projects,'bugs':all_bugs,'errors':errors}

class TapdClient:
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
    def request(self,method,path,args):
        data=None
        if method=='GET':path+='?'+urllib.parse.urlencode({**args,'s':'mcp'})
        else:data=urllib.parse.urlencode({**args,'s':'mcp'}).encode()
        req=urllib.request.Request('https://api.tapd.cn/'+path,data=data,method=method,
            headers={'Authorization':self.authorization,'Content-Type':'application/x-www-form-urlencoded' if data else 'application/json','Via':'mcp'})
        # Never forward an Authorization header to a redirected host.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args,**kwargs):raise PanelError('TAPD 返回重定向，已停止请求')
        with urllib.request.build_opener(NoRedirect).open(req,timeout=25) as r:return json.load(r)
    def get(self,path,args):return self.request('GET',path,args)
    def get_user_participant_projects(self,args):return self.get('workspaces/user_participant_projects',args)
    def get_workflows_status_map(self,args):return self.get('workflows/status_map',args)
    def get_workflows_last_steps(self,args):return self.get('workflows/last_steps',args)
    def get_bug(self,args):return self.get('bugs',args)
    def get_workspace_users(self,args):return self.get('workspaces/users',args)
    def get_workflows_all_transitions(self,args):return self.get('workflows/all_transitions',args)
    def update_bug(self,args):return self.request('POST','bugs',args)

def client():return TapdClient()

if __name__=='__main__':
    try:result={'ok':True,'data':dispatch(client(),json.loads(sys.argv[1]))}
    except PanelError as e:result={'ok':False,'error':str(e)}
    except Exception:result={'ok':False,'error':'TAPD 连接失败，请检查现有钥匙串授权、网络和项目权限'}
    print(json.dumps(result,ensure_ascii=False))
