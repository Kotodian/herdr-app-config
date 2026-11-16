#!/usr/bin/env python3
"""Credential-free Herdr App config sync, with optional macOS automation. Never synchronizes sessions."""
import argparse
import datetime
import fcntl
import hashlib
import io
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath

REPO='Kotodian/herdr-app-config'
SYNC_BRANCH='main'
SOURCE=Path(__file__).resolve().parent
APP=Path.home()/'.config/herdr-app'
STATE=Path.home()/'.config/herdr-app-sync/native-state.json'
ROOT=STATE.parent/'repository'
MARKER=b'__HERDR_' + b'SYNC_HOME__'
TEXT={'.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.sh','.swift','.json','.md','.txt','.svg','.html','.css','.toml','.lock','.webmanifest'}
ASSETS={'.png','.jpg','.jpeg','.webp','.ttf','.otf','.woff','.woff2'}
OMIT={'node_modules','__pycache__','.git','bin','data','target','dist'}
SECRET=re.compile(rb'gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer [A-Za-z0-9._-]{30,}')
COORDINATOR=PurePosixPath('integrations/herdr-project-coordinator')
SHEPHERDR=PurePosixPath('integrations/shepherdr')
SHEPHERDR_FOLDERS={'bin','core','docs','guard','layouts','lib','mods','service','templates','web'}
SHEPHERDR_ROOT_FILES={'package.json','bun.lock','bunfig.toml','install.sh','keys.json','LICENSE','LICENSE-herdr','NOTICE',
                     'README.md','RECIPE.md','AGENTS.md','tsconfig.json'}
SHEPHERDR_EXECUTABLES={'install.sh','bin/shepherdr','bin/herdr-browser','bin/herdr-browser-view','bin/herdr-secret',
                       'bin/sync-shared','guard/herdr-app','mods/tasks/bin/herdr-task','mods/artifacts/bin/herdr-artifact'}

def shepherdr_source(rel):
    """Portable release code, including helpers and built web assets; never machine data."""
    if rel.parts[:2]!=SHEPHERDR.parts:return False
    tail=rel.parts[2:]
    if len(tail)==1:return tail[0] in SHEPHERDR_ROOT_FILES
    if len(tail)<2 or tail[0] not in SHEPHERDR_FOLDERS:return False
    if any(x in OMIT-{'bin','dist'} or x.startswith('.') for x in tail):return False
    if 'dist' in tail and tail[:2]!=('web','dist'):return False
    name=PurePosixPath(*tail).as_posix()
    return rel.suffix in TEXT|ASSETS or name in SHEPHERDR_EXECUTABLES or rel.name in ('LICENSE','NOTICE','COPIES')

def text_file(path):
    rel=PurePosixPath(path.as_posix()) if isinstance(path,Path) else path
    return rel.suffix in TEXT or rel.name in ('LICENSE','LICENSE-herdr','NOTICE','COPIES') or (
        shepherdr_source(rel) and not rel.suffix)

def shepherdr_mods(app):
    path=app.joinpath(*SHEPHERDR.parts)/'lib/addons.json'
    if not path.exists():return set()
    data=read_json(path,{})
    return set(data.get('core',{}).get('mods',[]))|{m for addon in data.get('addons',[]) for m in addon.get('mods',[])}

def coordinator_source(rel):
    """Only the installed coordinator's program and bundled skill, never its cache or state."""
    if rel.parts[:2]!=COORDINATOR.parts:return False
    tail=rel.parts[2:]
    if tail in (('package.json',),('bun.lock',),('LICENSE',)):return True
    if len(tail)<2 or tail[0] not in ('src','plugin'):return False
    if any(x in OMIT for x in tail):return False
    if any(x.startswith('.') for x in tail):
        return tail==('plugin','.claude-plugin','plugin.json')
    return rel.suffix in ('.ts','.json','.md')

def digest(data):return hashlib.sha256(data).hexdigest()
def read_json(path,default):return json.loads(path.read_text()) if path.exists() else default

def run(*args,cwd=None):
    p=subprocess.run(args,cwd=cwd or ROOT,capture_output=True,text=True,timeout=120,env={**os.environ,'GIT_TERMINAL_PROMPT':'0'})
    if p.returncode:raise RuntimeError(f'{args[0]} {args[1] if len(args)>1 else ""} failed; inspect Git status/authentication (no force push was attempted)')
    return p.stdout.strip()

def git(*args):return run('git',*args)
def portable(data):return data.replace(str(Path.home()).encode(),MARKER)
def native(data):return data.replace(MARKER,str(Path.home()).encode())

def collect(app):
    installed=read_json(app/'installed.json',{})
    shepherdr=app.joinpath(*SHEPHERDR.parts)
    managed=shepherdr_mods(app)
    if (shepherdr/'bin/shepherdr').exists():managed.add('hcoord')
    mods=[p for p in (app/'mods').iterdir() if p.is_dir() and not p.is_symlink() and not p.name.startswith('.') and p.name not in installed and p.name not in managed]
    sources=[]
    for mod in mods:
        for p in mod.rglob('*'):
            rel=p.relative_to(mod)
            if not p.is_file() or p.is_symlink() or any(part in OMIT or part.startswith('.') for part in rel.parts):continue
            if p.name=='jsconfig.json' or p.name.endswith('.d.ts'):continue
            if p.suffix=='.json' and p.name not in ('mod.json','version.json','runtime.json'):continue
            if p.suffix in TEXT|ASSETS or p.name in ('LICENSE','NOTICE'):sources.append(p)
    for p in (app/'layouts').glob('*.json'):
        if 'layout:'+p.stem not in installed and not p.name.startswith('.'):sources.append(p)
    sources.extend(p for p in (app/'themes').glob('*.json') if p.stem!='atom-one-dark' and p.stem not in installed)
    sources.extend(app/name for name in ('keys.json','settings.json','programs.json','git-workflow.json','sync-app.py','tests/test_sync_app.py','README.md','.gitignore') if (app/name).exists())
    coordinator=app.joinpath(*COORDINATOR.parts)
    if coordinator.exists() and not (shepherdr/'bin/shepherdr').exists():
        for folder in ('src','plugin'):
            sources.extend(p for p in (coordinator/folder).rglob('*') if p.is_file() and coordinator_source(PurePosixPath(p.relative_to(app).as_posix())))
        sources.extend(coordinator/name for name in ('package.json','bun.lock','LICENSE') if (coordinator/name).exists())
    if shepherdr.exists():
        for directory,dirs,names in os.walk(shepherdr):
            dirs[:]=[d for d in dirs if not d.startswith('.') and d not in OMIT-{'bin','dist'}]
            for name in names:
                p=Path(directory)/name
                if p.is_file() and shepherdr_source(PurePosixPath(p.relative_to(app).as_posix())):sources.append(p)
    files={}
    for p in sources:
        if p.is_symlink():raise RuntimeError('Refusing symlink: '+str(p))
        rel=p.relative_to(app).as_posix();data=p.read_bytes()
        if text_file(PurePosixPath(rel)):data=portable(data)
        if rel=='layouts/shepherdr.json' and (shepherdr/'layouts/shepherdr.json').exists():
            live=json.loads(data)
            source=json.loads(portable((shepherdr/'layouts/shepherdr.json').read_bytes()))
            def nodes(value):
                yield value
                for child in value.get('children',[]):yield from nodes(child)
            defaults={n['id']:n.get('content') for n in nodes(source) if n.get('id') in ('tasks-thread-term','artifacts-view-body')}
            for n in nodes(live):
                if n.get('id') in defaults:
                    if defaults[n['id']] is None:n.pop('content',None)
                    else:n['content']=defaults[n['id']]
            data=(json.dumps(live,ensure_ascii=False,indent=2)+'\n').encode()
        if SECRET.search(data):raise RuntimeError('Possible secret; export stopped at '+rel)
        files[rel]=data
    return files,sorted(p.name for p in mods)

def manifest(files,mods):return {'schema':1,'mods':mods,'files':{name:{'sha256':digest(data)} for name,data in sorted(files.items())}}

def snapshot(files,mods):
    old=read_json(ROOT/'manifest.json',{}).get('files',{})
    for name in old.keys()-files.keys():
        p=ROOT/name
        if p.is_file():p.unlink()
    for name,data in files.items():
        p=ROOT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    (ROOT/'manifest.json').write_text(json.dumps(manifest(files,mods),ensure_ascii=False,indent=2)+'\n')

def validate(folder=None):
    folder=ROOT if folder is None else folder
    m=read_json(folder/'manifest.json',{})
    if m.get('schema')!=1:raise RuntimeError('Unsupported snapshot manifest')
    files={}
    for name,info in m['files'].items():
        rel=PurePosixPath(name)
        if rel.is_absolute() or '..' in rel.parts or not rel.parts:raise RuntimeError('Unsafe snapshot path')
        shepherdr=shepherdr_source(rel)
        integration=coordinator_source(rel) or shepherdr
        allowed=integration or (rel.parts[0] in ('mods','layouts','themes') and len(rel.parts)>1) or name in ('keys.json','settings.json','programs.json','git-workflow.json','sync-app.py','tests/test_sync_app.py','README.md','.gitignore')
        if not allowed or any((x.startswith('.') and name!='.gitignore' and not integration) or
                              (x in OMIT and not (shepherdr and x in ('bin','dist'))) for x in rel.parts):raise RuntimeError('Refusing runtime/state file: '+name)
        if rel.parts[0]=='mods' and (rel.suffix not in TEXT|ASSETS and rel.name not in ('LICENSE','NOTICE')):raise RuntimeError('Unexpected mod file')
        p=folder.joinpath(*rel.parts)
        if p.is_symlink() or any(parent.is_symlink() for parent in p.parents if parent!=folder.parent):raise RuntimeError('Snapshot contains a symlink')
        data=p.read_bytes()
        if digest(data)!=info['sha256'] or SECRET.search(data):raise RuntimeError('Snapshot integrity/secret check failed: '+name)
        files[name]=data
    return m,files

def revision_files(revision):
    """Read a divergent remote snapshot without checking it out over local commits."""
    result=subprocess.run(['git','archive','--format=tar',revision],cwd=ROOT,capture_output=True,timeout=120)
    if result.returncode:raise RuntimeError('Unable to read the remote configuration snapshot')
    with tempfile.TemporaryDirectory(prefix='herdr-remote-') as directory:
        folder=Path(directory).resolve()
        with tarfile.open(fileobj=io.BytesIO(result.stdout),mode='r:') as archive:
            for member in archive.getmembers():
                rel=PurePosixPath(member.name)
                if rel.is_absolute() or '..' in rel.parts or member.issym() or member.islnk():raise RuntimeError('Unsafe remote snapshot archive')
                if not member.isfile():continue
                path=folder.joinpath(*rel.parts);path.parent.mkdir(parents=True,exist_ok=True)
                path.write_bytes(archive.extractfile(member).read())
        return validate(folder)

def hashes(files):return {k:digest(v) for k,v in files.items()}
def remember_bases(files):
    """Keep the exact exported text needed for a later three-way merge."""
    folder=STATE.parent/'merge-bases'
    for name,data in files.items():
        if not text_file(PurePosixPath(name)):continue
        path=folder/digest(data)
        if path.exists():continue
        folder.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)

def load_base(name,sha):
    if not sha or not re.fullmatch(r'[0-9a-f]{64}',sha):return None
    path=STATE.parent/'merge-bases'/sha
    if not path.exists():return None
    data=path.read_bytes()
    return data if digest(data)==sha else None

def save_hash_state(files):
    STATE.parent.mkdir(parents=True,exist_ok=True)
    tmp=STATE.with_suffix('.json.tmp');tmp.write_text(json.dumps({'files':files},indent=2)+'\n');tmp.replace(STATE)

def save_state(files):
    remember_bases(files)
    save_hash_state(hashes(files))

def published_baseline(baseline,local,published):
    """Acknowledge uploaded bytes, but never acknowledge incoming files before applying them."""
    result=dict(baseline)
    for name in set(baseline)|set(local)|set(published):
        if local.get(name)!=published.get(name):continue
        if name in published:result[name]=digest(published[name])
        else:result.pop(name,None)
    return result

def apply(app,overwrite=False,execute=False,expected_local=None):
    m,files=validate();baseline=read_json(STATE,{}).get('files',{})
    changes=[];conflicts=[]
    for name,data in files.items():
        p=app/name
        if p.is_symlink() or any(parent.is_symlink() for parent in p.parents if parent!=app.parent):raise RuntimeError('Destination contains symlink: '+name)
        local=portable(p.read_bytes()) if p.exists() and text_file(PurePosixPath(name)) else p.read_bytes() if p.exists() else None
        current=None if local is None else digest(local);remote=digest(data);old=baseline.get(name)
        if current==remote:continue
        if old is not None and current!=old and remote==old:continue # preserve local-only edits
        expected=expected_local is not None and expected_local.get(name)==current
        if current is not None and current!=old and current!=remote and not overwrite and not expected:conflicts.append(name)
        else:changes.append((name,data))
    if conflicts:raise RuntimeError('Local configuration differs; nothing changed. Review these files or use --overwrite (with backup): '+', '.join(conflicts[:12]))
    print(f'{len(changes)} files to install/update; other files and sessions stay in place')
    if not execute:print('Preview only. Add --apply to write after backup.');return
    backup=app/'backups'/('github-sync-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True,exist_ok=False)
    for name,data in changes:
        p=app/name
        if p.exists():
            saved=backup/name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,saved)
        p.parent.mkdir(parents=True,exist_ok=True)
        tmp=p.with_name('.'+p.name+'.sync-tmp');tmp.write_bytes(native(data) if text_file(PurePosixPath(name)) else data);tmp.replace(p)
        if p.suffix=='.sh':p.chmod(0o755)
    # Host-specific executable locations are generated locally, never copied from another Mac.
    if (app/'mods/gitview').exists():
        config=app/'mods/gitview/config.json'
        text=json.dumps({'bin':str(app/'mods/gitview/bin/herdr-gitview'),'herdr_app':shutil.which('herdr-app') or str(Path.home()/'.local/bin/herdr-app'),'hc':shutil.which('hc') or str(Path.home()/'.local/bin/hc')},indent=2)+'\n'
        if not config.exists() or config.read_text()!=text:
            if config.exists():shutil.copy2(config,backup/'gitview-config.json')
            config.write_text(text)
    shepherdr_runtime(app)
    save_state(files);print('Applied. Backup: '+str(backup));print('Select a layout in Herdr App if needed. Run doctor for checks.')

def shepherdr_runtime(app):
    """Register this machine's helpers, hooks and service from the synchronized checkout."""
    source=app.joinpath(*SHEPHERDR.parts)
    if not (source/'bin/shepherdr').is_file():return
    files,_=collect(app)
    release={name:digest(data) for name,data in files.items() if shepherdr_source(PurePosixPath(name))}
    fingerprint=digest(json.dumps(release,sort_keys=True).encode())
    stamp=STATE.parent/'shepherdr-runtime.json'
    record=app/'data/shepherdr/installed.json'
    links=('shepherdr','herdr-task','herdr-artifact','herdr-secret','herdr-browser')
    if (read_json(stamp,{}).get('source_sha256')==fingerprint and record.exists() and
        all((Path.home()/'.local/bin'/name).exists() for name in links)):return
    for name in SHEPHERDR_EXECUTABLES:
        path=source/name
        if path.is_file():path.chmod(0o755)
    command=[sys.executable,str(source/'bin/shepherdr'),'install','--keys','keep','--source',str(source)]
    result=subprocess.run(command,cwd=source,capture_output=True,text=True,timeout=1200)
    if result.returncode or 'NOT DONE:' in result.stdout:
        raise RuntimeError('Shepherdr local installation failed:\n'+'\n'.join((result.stdout+result.stderr).splitlines()[-15:]))
    result=subprocess.run([sys.executable,str(source/'bin/shepherdr'),'doctor'],cwd=source,capture_output=True,text=True,timeout=120)
    if result.returncode:raise RuntimeError('Shepherdr doctor failed:\n'+'\n'.join((result.stdout+result.stderr).splitlines()[-15:]))
    stamp.parent.mkdir(parents=True,exist_ok=True)
    # A first install may build the web app: acknowledge those generated assets too.
    files,_=collect(app)
    release={name:digest(data) for name,data in files.items() if shepherdr_source(PurePosixPath(name))}
    stamp.write_text(json.dumps({'source_sha256':digest(json.dumps(release,sort_keys=True).encode())})+'\n')
    print('Shepherdr helpers, hooks and service registered from '+str(source),flush=True)

def runtime(app):
    if platform.system()!='Darwin':raise RuntimeError('This runtime installer supports macOS')
    arch=platform.machine();targets={'arm64':('aarch64','7d605022028eb70c253becb16b0900247f341d41ae61e67dc01c12dea25776ee'),'x86_64':('x86_64','4db51282b1547ffecd429387f20d0349026649b9d7f8db6eeb6b75e906108cb8')}
    if arch not in targets:raise RuntimeError('Unsupported architecture')
    target,sha=targets[arch];asset=f'herdr-gitview-app-{target}-apple-darwin.tar.gz'
    url='https://github.com/ChmaraX/herdr-gitview/releases/download/v0.5.0/'+asset
    with urllib.request.urlopen(url,timeout=60) as r:data=r.read(32*1024*1024)
    if digest(data)!=sha:raise RuntimeError('Gitview release checksum mismatch')
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
        members=[m for m in t.getmembers() if m.isfile() and PurePosixPath(m.name).name=='herdr-gitview']
        if len(members)!=1:raise RuntimeError('Unexpected Gitview release contents')
        binary=t.extractfile(members[0]).read()
    p=app/'mods/gitview/bin/herdr-gitview';p.parent.mkdir(parents=True,exist_ok=True)
    if p.exists():shutil.copy2(p,p.with_name('herdr-gitview.before-sync'))
    tmp=p.with_suffix('.sync-tmp');tmp.write_bytes(binary);tmp.chmod(0o755);tmp.replace(p)
    print('Installed verified Gitview v0.5.0 runtime for '+arch)

def doctor(app):
    m,_=validate();cli=shutil.which('herdr-app') or str(Path.home()/'.local/bin/herdr-app');failed=[]
    for mod in m['mods']:
        try:run(cli,'check',str(app/'mods'/mod))
        except Exception:failed.append(mod)
    print('Mod checks:',len(m['mods'])-len(failed),'passed;',len(failed),'failed')
    if failed:print('Failed:',', '.join(failed))
    print('Runtime:', 'Gitview present' if (app/'mods/gitview/bin/herdr-gitview').exists() else 'run runtime to install Gitview')
    print('Connect Magpie/Cloudflare and TAPD separately on this Mac; credentials are never restored from Git')
    if failed:raise RuntimeError('Some mod checks failed')

LABEL='com.kotodian.herdr-app-sync'

class ConfigurationConflict(RuntimeError):
    def __init__(self,details):
        self.details=details
        super().__init__('Configuration conflict; nothing applied: '+', '.join(d['name'] for d in details[:12]))

class JsonConflict(ValueError):pass
MISSING=object()

def keyed_nodes(value):
    return isinstance(value,list) and all(isinstance(v,dict) and isinstance(v.get('id'),str) for v in value) and len({v['id'] for v in value})==len(value)

def merge_node_order(base,left,right,kept):
    common=set(base)&set(left)&set(right)&set(kept)
    b=[v for v in base if v in common];l=[v for v in left if v in common];r=[v for v in right if v in common]
    if l!=b and r!=b and l!=r:raise JsonConflict('both sides reordered the same nodes')
    primary=right if r!=b else left
    other=left if r!=b else right
    result=[v for v in primary if v in kept]
    for i,value in enumerate(other):
        if value not in kept or value in result:continue
        after=next((v for v in other[i+1:] if v in result),None)
        if after is not None:result.insert(result.index(after),value)
        else:result.append(value)
    return result

def merge_json(base,left,right,path=(),kanso=False):
    if kanso and isinstance(left,dict) and isinstance(right,dict) and left.get('id')=='panel-body':
        before=dict(base) if isinstance(base,dict) else base
        right=dict(right)
        for key in ('children','active','hidden'):
            for value in (before,right):
                if not isinstance(value,dict):continue
                if key in left:value[key]=left[key]
                else:value.pop(key,None)
        base=before
    if kanso and len(path)>1 and path[-2:]==('work-body','children') and keyed_nodes(base) and keyed_nodes(left) and keyed_nodes(right):
        live=lambda node:node['id']=='main' or node['id'].startswith('strip-')
        if any(live(node) for nodes in (base,left,right) for node in nodes):
            stable=lambda nodes:[node for node in nodes if not live(node)]
            merged=merge_json(stable(base),stable(left),stable(right),path,kanso=True)
            runtime=[node for node in left if live(node)]
            at=next((i for i,n in enumerate(left) if live(n)),0)
            return merged[:at]+runtime+merged[at:]
    if left==right:return left
    if left==base:return right
    if right==base:return left
    if isinstance(left,dict) and isinstance(right,dict) and (isinstance(base,dict) or base is MISSING):
        before={} if base is MISSING else base
        result={}
        for key in dict.fromkeys([*left,*right,*before]):
            # A different computer's selected panel is never an incoming preference.
            if kanso and left.get('id')=='panel-body' and key in ('children','active','hidden'):
                value=left.get(key,MISSING)
            else:value=merge_json(before.get(key,MISSING),left.get(key,MISSING),right.get(key,MISSING),path+(key,),kanso)
            if value is not MISSING:result[key]=value
        return result
    if keyed_nodes(base) and keyed_nodes(left) and keyed_nodes(right):
        b={v['id']:v for v in base};l={v['id']:v for v in left};r={v['id']:v for v in right};result={}
        for key in dict.fromkeys([*l,*r,*b]):
            value=merge_json(b.get(key,MISSING),l.get(key,MISSING),r.get(key,MISSING),path+(key,),kanso)
            if value is not MISSING:result[key]=value
        return [result[key] for key in merge_node_order(list(b),list(l),list(r),result)]
    raise JsonConflict('both sides changed '+'.'.join(path or ('root',)))

def merge_content(name,base,left,right):
    if base is None or left is None or right is None:return None,'missing merge base or a removal'
    if name.endswith('.json'):
        try:
            result=merge_json(json.loads(base),json.loads(left),json.loads(right),kanso=name=='layouts/kanso.json')
            return (json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode(),None
        except (ValueError,TypeError) as error:return None,str(error)
    if PurePosixPath(name).suffix in TEXT:
        with tempfile.TemporaryDirectory(prefix='herdr-config-merge-') as directory:
            paths=[Path(directory)/n for n in ('local','base','remote')]
            for path,data in zip(paths,(left,base,right)):path.write_bytes(data)
            result=subprocess.run(['git','merge-file','-p',*map(str,paths)],capture_output=True,timeout=15)
            if result.returncode==0:return result.stdout,None
        return None,'overlapping text changes'
    return None,'binary changes require review'

def keep_kanso_runtime(target,local):
    """Merge preferences while keeping this screen's live terminals and selected panel."""
    source={}
    def index(node):
        if not isinstance(node,dict):return
        if isinstance(node.get('id'),str):source[node['id']]=node
        for child in node.get('children',[]):index(child)
    index(local)
    def preserve(node):
        if not isinstance(node,dict):return node
        result=dict(node);here=source.get(node.get('id'),{})
        if node.get('id')=='panel-body':
            for key in ('children','active','hidden'):
                if key in here:result[key]=here[key]
                else:result.pop(key,None)
        elif 'children' in result:
            children=[preserve(child) for child in result['children']]
            if node.get('id')=='work-body' and here:
                live=lambda n:n.get('id')=='main' or str(n.get('id','')).startswith('strip-')
                runtime=[n for n in here.get('children',[]) if live(n)]
                if runtime:
                    stable=[n for n in children if not live(n)]
                    before=next((i for i,n in enumerate(here['children']) if live(n)),0)
                    children=stable[:before]+runtime+stable[before:]
            result['children']=children
        return result
    return preserve(target)

def save_conflicts(details):
    for item in details:
        key=digest((item['name']+''.join(digest(item[k]) if item[k] is not None else '-' for k in ('base','local','remote'))).encode())
        folder=STATE.parent/'conflicts'/key
        folder.mkdir(parents=True,exist_ok=True)
        (folder/'info.json').write_text(json.dumps({'path':item['name'],'reason':item['reason']},ensure_ascii=False,indent=2)+'\n')
        for key in ('base','local','remote'):
            if item[key] is not None:(folder/key).write_bytes(item[key])

def merge_files(baseline,local,remote,resolved=None):
    """Merge disjoint edits against exact baselines; retain both sides of ambiguous edits."""
    merged={};conflicts=[]
    for name in sorted(set(baseline)|set(local)|set(remote)):
        left=local.get(name);right=remote.get(name);old=baseline.get(name)
        lh=None if left is None else digest(left);rh=None if right is None else digest(right)
        if lh==rh:
            if left is not None:merged[name]=left
        elif old is not None and (left is None or right is None):
            conflicts.append({'name':name,'base':load_base(name,old),'local':left,'remote':right,'reason':'removal requires review'})
        elif lh==old:
            if right is not None:merged[name]=right
        elif rh==old:
            if left is not None:merged[name]=left
        else:
            base=load_base(name,old)
            data,reason=merge_content(name,base,left,right)
            if data is not None:
                merged[name]=data
                if resolved is not None:resolved.append(name)
            else:conflicts.append({'name':name,'base':base,'local':left,'remote':right,'reason':reason})
    if conflicts:raise ConfigurationConflict(conflicts)
    name='layouts/kanso.json'
    if name in merged and name in local and merged[name]!=local[name]:
        target=json.loads(merged[name])
        preserved=keep_kanso_runtime(target,json.loads(local[name]))
        if preserved!=target:merged[name]=(json.dumps(preserved,ensure_ascii=False,indent=2)+'\n').encode()
    return merged

def validate_changes(merged,local,app):
    changed=[name for name,data in merged.items() if local.get(name)!=data]
    for name,data in merged.items():
        if name.endswith('.json'):json.loads(native(data))
    mods=sorted({PurePosixPath(n).parts[1] for n in changed if n.startswith('mods/')})
    if not mods:return
    cli=shutil.which('herdr-app') or str(Path.home()/'.local/bin/herdr-app')
    with tempfile.TemporaryDirectory(prefix='herdr-sync-check-') as directory:
        stage=Path(directory)
        for name,data in merged.items():
            if name.startswith('mods/') and PurePosixPath(name).parts[1] in mods:
                p=stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(native(data) if p.suffix in TEXT else data)
        for mod in mods:run(cli,'check',str(stage/'mods'/mod))

def record_status(status,**extra):
    path=STATE.with_name('native-status.json');previous=read_json(path,{})
    now=datetime.datetime.now().astimezone().isoformat()
    data={**previous,'status':status,'last_attempt':now,**extra}
    if status=='ok':
        data['last_success']=now
        data.pop('error',None)
        data.pop('pending_reason',None)
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.json.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)

def auto_sync(app):
    history_merge_started=False
    try:
        if not STATE.exists():
            _,initial=validate();save_state(initial)
        if git('branch','--show-current')!=SYNC_BRANCH:raise RuntimeError('Expected '+SYNC_BRANCH+' branch for configuration synchronization')
        if git('status','--porcelain','--untracked-files=no'):raise RuntimeError('Repository has pending edits; automatic sync paused')
        git('fetch','origin',SYNC_BRANCH)
        remote_ref='origin/'+SYNC_BRANCH
        ahead,behind=map(int,git('rev-list','--left-right','--count','HEAD...'+remote_ref).split())
        if ahead:
            _,remote=revision_files(remote_ref)
        else:
            git('merge','--ff-only',remote_ref)
            _,remote=validate()
        local,_=collect(app);baseline=read_json(STATE,{}).get('files',{})
        resolved=[]
        merged=merge_files(baseline,local,remote,resolved)
        validate_changes(merged,{name:data for name,data in local.items() if remote.get(name)==data},app)
        # Edits made while network/checks were running stay with the editor; retry later.
        if hashes(collect(app)[0])!=hashes(local):
            record_status('pending',error=None,pending_reason='App configuration changed during sync; retrying next cycle')
            print('Configuration changed during checks; local edits retained for the next cycle',flush=True)
            return
        incoming=sum(local.get(name)!=data for name,data in merged.items())
        outgoing=sum(remote.get(name)!=data for name,data in merged.items())
        if ahead and behind:
            # File-level reconciliation above decided the content. Preserve both histories;
            # the temporary ours tree is replaced by that validated content before committing.
            git('merge','--no-commit','--no-ff','--strategy=ours',remote_ref)
            history_merge_started=True
        _,checkout=validate()
        if hashes(merged)!=hashes(checkout) or history_merge_started:
            mods=sorted({PurePosixPath(n).parts[1] for n in merged if n.startswith('mods/')})
            snapshot(merged,mods);validate()
            git('add','-A','--','.')
            if git('diff','--cached','--name-only') or history_merge_started:
                git('commit','-m','chore(herdr): 同步应用配置')
            history_merge_started=False
        # Push before applying incoming changes. A failed push leaves the base intact.
        git('push','origin','HEAD:'+SYNC_BRANCH)
        # Kanso can save a new terminal/panel layout while the push is in flight.
        # Record the bytes that actually reached Git before checking the live files again.
        remember_bases({name:data for name,data in merged.items() if local.get(name)==data})
        save_hash_state(published_baseline(baseline,local,merged))
        if hashes(collect(app)[0])!=hashes(local):
            record_status('pending',commit=git('rev-parse','HEAD'),uploaded_files=outgoing,applied_files=0,
                          error=None,pending_reason='Upload succeeded; newer local edits will sync next cycle')
            print('Upload succeeded; newer local edits retained for the next cycle',flush=True)
            return
        if incoming:apply(app,False,True,expected_local=hashes(local))
        else:save_state(merged)
        shepherdr_runtime(app)
        commit=git('rev-parse','HEAD')
        record_status('ok',commit=commit,uploaded_files=outgoing,applied_files=incoming,auto_merged=resolved)
        print(f'Auto sync OK: {outgoing} uploaded, {incoming} applied; {commit[:12]}',flush=True)
    except Exception as e:
        if history_merge_started and (ROOT/'.git/MERGE_HEAD').exists():git('merge','--abort')
        if isinstance(e,ConfigurationConflict):save_conflicts(e.details)
        record_status('error',error=str(e));raise

def ensure_repo(app):
    expected=('https://github.com/'+REPO+'.git','git@github.com:'+REPO+'.git')
    if not (ROOT/'.git').exists():
        url=expected[0]
        if (app/'.git').exists():
            candidate=run('git','config','--get','remote.origin.url',cwd=app)
            if candidate in expected:url=candidate
        ROOT.parent.mkdir(parents=True,exist_ok=True)
        args=['git']
        gh=shutil.which('gh')
        if gh and subprocess.run([gh,'auth','status'],capture_output=True).returncode==0:
            args+=['-c','credential.helper=','-c','credential.helper=!'+gh+' auth git-credential']
        run(*args,'clone','--branch',SYNC_BRANCH,url,str(ROOT),cwd=ROOT.parent)
        git('config','user.name','Herdr App Sync');git('config','user.email','22030659+Kotodian@users.noreply.github.com');git('config','commit.gpgsign','false')
        if len(args)>1:
            git('config','credential.helper','');git('config','--add','credential.helper','!'+gh+' auth git-credential')
    if git('config','--get','remote.origin.url') not in expected:raise RuntimeError('Unexpected configuration repository')
    if git('branch','--show-current')!=SYNC_BRANCH:
        if git('branch','--show-current')!='dev' or git('status','--porcelain'):
            raise RuntimeError('Switch the clean configuration checkout to '+SYNC_BRANCH+' before syncing')
        git('fetch','origin',SYNC_BRANCH)
        if git('rev-list','--count','origin/'+SYNC_BRANCH+'..HEAD')!='0':
            raise RuntimeError('The old dev checkout has commits not yet merged into main; merge them before switching configuration sync')
        refs=set(git('for-each-ref','--format=%(refname)','refs/heads/'+SYNC_BRANCH,'refs/remotes/origin/'+SYNC_BRANCH).splitlines())
        if 'refs/heads/'+SYNC_BRANCH in refs:git('switch',SYNC_BRANCH)
        elif 'refs/remotes/origin/'+SYNC_BRANCH in refs:git('switch','--track','-c',SYNC_BRANCH,'origin/'+SYNC_BRANCH)
        else:
            raise RuntimeError('The configuration main branch is missing; restore it before syncing')

def register_agent(app):
    import plistlib,sys
    agent=Path.home()/'Library/LaunchAgents'/(LABEL+'.plist');agent.parent.mkdir(parents=True,exist_ok=True)
    log=Path.home()/'Library/Logs/HerdrAppSync.log';log.parent.mkdir(parents=True,exist_ok=True)
    definition={'Label':LABEL,'ProgramArguments':[sys.executable,str(app/'sync-app.py'),'auto','--app-home',str(app)],'WorkingDirectory':str(app),
        'EnvironmentVariables':{'PATH':str(Path.home()/'.local/bin')+':/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin','PYTHONUNBUFFERED':'1'},
        'RunAtLoad':True,'StartInterval':300,'ProcessType':'Background','StandardOutPath':str(log),'StandardErrorPath':str(log)}
    expected=plistlib.dumps(definition);domain='gui/'+str(os.getuid())
    loaded=subprocess.run(['launchctl','print',domain+'/'+LABEL],capture_output=True).returncode==0
    if agent.exists() and agent.read_bytes()==expected and loaded:return
    if agent.exists():shutil.copy2(agent,agent.with_suffix('.plist.before-native-sync'))
    agent.write_bytes(expected)
    subprocess.run(['launchctl','bootout',domain,str(agent)],capture_output=True)
    run('launchctl','bootstrap',domain,str(agent))

def bootstrap(app):
    ensure_repo(app)
    if not STATE.exists():
        _,initial=validate();save_state(initial)
    if (app/'mods/gitview').exists():
        if not (app/'mods/gitview/bin/herdr-gitview').exists():runtime(app)
        config=app/'mods/gitview/config.json'
        if not config.exists():config.write_text(json.dumps({'bin':str(app/'mods/gitview/bin/herdr-gitview'),'herdr_app':shutil.which('herdr-app') or str(Path.home()/'.local/bin/herdr-app'),'hc':shutil.which('hc') or str(Path.home()/'.local/bin/hc')},indent=2)+'\n')
    auto_sync(app);register_agent(app)
    print('Herdr native configuration initialized; automatic sync enabled',flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['bootstrap','auto','runtime','doctor']);parser.add_argument('--app-home',type=Path,default=APP);args=parser.parse_args()
    STATE.parent.mkdir(parents=True,exist_ok=True)
    with (STATE.parent/'.native-sync.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:print('Another sync is running; retrying next cycle',flush=True);return
        if args.command=='bootstrap':bootstrap(args.app_home)
        elif args.command=='auto':ensure_repo(args.app_home);auto_sync(args.app_home)
        elif args.command=='runtime':runtime(args.app_home)
        elif args.command=='doctor':ensure_repo(args.app_home);doctor(args.app_home)

if __name__=='__main__':
    try:main()
    except Exception as e:
        record_status('error',error=str(e));print('App sync stopped: '+str(e),file=__import__('sys').stderr);raise SystemExit(1)
