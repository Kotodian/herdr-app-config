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
import tarfile
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath

REPO='Kotodian/herdr-app-config'
SOURCE=Path(__file__).resolve().parent
APP=Path.home()/'.config/herdr-app'
STATE=Path.home()/'.config/herdr-app-sync/native-state.json'
ROOT=STATE.parent/'repository'
MARKER=b'__HERDR_' + b'SYNC_HOME__'
TEXT={'.js','.mjs','.cjs','.py','.sh','.json','.md','.txt','.svg','.html','.css'}
ASSETS={'.png','.jpg','.jpeg','.webp','.ttf','.otf','.woff','.woff2'}
OMIT={'node_modules','__pycache__','.git','bin','data','target','dist'}
SECRET=re.compile(rb'gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer [A-Za-z0-9._-]{30,}')

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
    mods=[p for p in (app/'mods').iterdir() if p.is_dir() and not p.is_symlink() and not p.name.startswith('.') and p.name not in installed]
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
    sources.extend(app/name for name in ('keys.json','settings.json','programs.json','sync-app.py','README.md','.gitignore') if (app/name).exists())
    files={}
    for p in sources:
        if p.is_symlink():raise RuntimeError('Refusing symlink: '+str(p))
        rel=p.relative_to(app).as_posix();data=p.read_bytes()
        if p.suffix in TEXT or p.name in ('LICENSE','NOTICE'):data=portable(data)
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

def validate():
    folder=ROOT;m=read_json(folder/'manifest.json',{})
    if m.get('schema')!=1:raise RuntimeError('Unsupported snapshot manifest')
    files={}
    for name,info in m['files'].items():
        rel=PurePosixPath(name)
        if rel.is_absolute() or '..' in rel.parts or not rel.parts:raise RuntimeError('Unsafe snapshot path')
        allowed=(rel.parts[0] in ('mods','layouts','themes') and len(rel.parts)>1) or name in ('keys.json','settings.json','programs.json','sync-app.py','README.md','.gitignore')
        if not allowed or any((x.startswith('.') and name!='.gitignore') or x in OMIT for x in rel.parts):raise RuntimeError('Refusing runtime/state file: '+name)
        if rel.parts[0]=='mods' and (rel.suffix not in TEXT|ASSETS and rel.name not in ('LICENSE','NOTICE')):raise RuntimeError('Unexpected mod file')
        p=folder.joinpath(*rel.parts)
        if p.is_symlink() or any(parent.is_symlink() for parent in p.parents if parent!=ROOT.parent):raise RuntimeError('Snapshot contains a symlink')
        data=p.read_bytes()
        if digest(data)!=info['sha256'] or SECRET.search(data):raise RuntimeError('Snapshot integrity/secret check failed: '+name)
        files[name]=data
    return m,files

def hashes(files):return {k:digest(v) for k,v in files.items()}
def save_state(files):
    STATE.parent.mkdir(parents=True,exist_ok=True)
    tmp=STATE.with_suffix('.json.tmp');tmp.write_text(json.dumps({'files':hashes(files)},indent=2)+'\n');tmp.replace(STATE)

def apply(app,overwrite=False,execute=False):
    m,files=validate();baseline=read_json(STATE,{}).get('files',{})
    changes=[];conflicts=[]
    for name,data in files.items():
        p=app/name
        if p.is_symlink() or any(parent.is_symlink() for parent in p.parents if parent!=app.parent):raise RuntimeError('Destination contains symlink: '+name)
        local=portable(p.read_bytes()) if p.exists() and p.suffix in TEXT else p.read_bytes() if p.exists() else None
        current=None if local is None else digest(local);remote=digest(data);old=baseline.get(name)
        if current==remote:continue
        if old is not None and current!=old and remote==old:continue # preserve local-only edits
        if current is not None and current!=old and current!=remote and not overwrite:conflicts.append(name)
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
        tmp=p.with_name('.'+p.name+'.sync-tmp');tmp.write_bytes(native(data) if p.suffix in TEXT else data);tmp.replace(p)
        if p.suffix=='.sh':p.chmod(0o755)
    # Host-specific executable locations are generated locally, never copied from another Mac.
    if (app/'mods/gitview').exists():
        config=app/'mods/gitview/config.json'
        text=json.dumps({'bin':str(app/'mods/gitview/bin/herdr-gitview'),'herdr_app':shutil.which('herdr-app') or str(Path.home()/'.local/bin/herdr-app'),'hc':shutil.which('hc') or str(Path.home()/'.local/bin/hc')},indent=2)+'\n'
        if not config.exists() or config.read_text()!=text:
            if config.exists():shutil.copy2(config,backup/'gitview-config.json')
            config.write_text(text)
    save_state(files);print('Applied. Backup: '+str(backup));print('Select kanso in Herdr App if needed. Run doctor for checks.')

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

def merge_files(baseline,local,remote):
    """Merge independent file edits; never guess at a same-file conflict/deletion."""
    merged={};conflicts=[]
    for name in sorted(set(baseline)|set(local)|set(remote)):
        left=local.get(name);right=remote.get(name);old=baseline.get(name)
        lh=None if left is None else digest(left);rh=None if right is None else digest(right)
        if lh==rh:
            if left is not None:merged[name]=left
        elif old is not None and (left is None or right is None):
            conflicts.append(name+' (removal needs review)')
        elif lh==old:
            if right is not None:merged[name]=right
        elif rh==old:
            if left is not None:merged[name]=left
        else:conflicts.append(name)
    if conflicts:raise RuntimeError('Configuration conflict; nothing applied: '+', '.join(conflicts[:12]))
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
    if status=='ok':data['last_success']=now;data.pop('error',None)
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.json.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)

def auto_sync(app):
    try:
        if not STATE.exists():
            _,initial=validate();save_state(initial)
        if git('branch','--show-current')!='main':raise RuntimeError('Expected main branch')
        if git('status','--porcelain','--untracked-files=no'):raise RuntimeError('Repository has pending edits; automatic sync paused')
        git('fetch','origin','main')
        try:git('merge','--no-edit','--no-gpg-sign','origin/main')
        except RuntimeError:
            if (ROOT/'.git/MERGE_HEAD').exists():git('merge','--abort')
            raise RuntimeError('Git histories conflict; local commits retained for review') from None
        _,remote=validate();local,_=collect(app);baseline=read_json(STATE,{}).get('files',{})
        merged=merge_files(baseline,local,remote)
        validate_changes(merged,{name:data for name,data in local.items() if remote.get(name)==data},app)
        # Edits made while network/checks were running stay with the editor; retry later.
        if hashes(collect(app)[0])!=hashes(local):raise RuntimeError('App configuration changed during sync; retrying next cycle')
        incoming=sum(local.get(name)!=data for name,data in merged.items())
        outgoing=sum(remote.get(name)!=data for name,data in merged.items())
        if hashes(merged)!=hashes(remote):
            mods=sorted({PurePosixPath(n).parts[1] for n in merged if n.startswith('mods/')})
            snapshot(merged,mods);validate()
            git('add','-A','--','.')
            if git('diff','--cached','--name-only'):git('commit','-m','Automatically sync Herdr App configuration')
        # Push before applying incoming changes. A failed push leaves the base intact.
        git('push','origin','HEAD:main')
        if hashes(collect(app)[0])!=hashes(local):raise RuntimeError('App configuration changed during push; retrying next cycle')
        if incoming:apply(app,False,True)
        else:save_state(merged)
        commit=git('rev-parse','HEAD')
        record_status('ok',commit=commit,uploaded_files=outgoing,applied_files=incoming)
        print(f'Auto sync OK: {outgoing} uploaded, {incoming} applied; {commit[:12]}',flush=True)
    except Exception as e:
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
        run(*args,'clone',url,str(ROOT),cwd=ROOT.parent)
        git('config','user.name','Herdr App Sync');git('config','user.email','22030659+Kotodian@users.noreply.github.com');git('config','commit.gpgsign','false')
        if len(args)>1:
            git('config','credential.helper','');git('config','--add','credential.helper','!'+gh+' auth git-credential')
    if git('config','--get','remote.origin.url') not in expected:raise RuntimeError('Unexpected configuration repository')

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
