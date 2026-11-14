import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {Database} from 'bun:sqlite';
test('additive campaign database upgrade and account-bound API persistence',()=>{
 const dir=mkdtempSync(join(tmpdir(),'operations-account-'));
 try{
  writeFileSync(join(dir,'test.db'),'');const env={...process.env,DATABASE_URL:'file:'+join(dir,'test.db')};
  const schema=readFileSync('prisma/schema.prisma','utf8').replace(/^  operations(?:Progress|Runs) String.*\n/gm,'');writeFileSync(join(dir,'legacy.prisma'),schema);
  const old=spawnSync('node',['node_modules/prisma/build/index.js','db','push','--skip-generate','--schema',join(dir,'legacy.prisma')],{env,encoding:'utf8'});expect(old.status,old.stderr).toBe(0);
  const legacy=new Database(join(dir,'test.db'));legacy.run("INSERT INTO Player (id,playerKey,name,xp,credits,updatedAt) VALUES ('legacy-operations','legacy-operations','Legacy',1234,5678,CURRENT_TIMESTAMP)");legacy.close();
  const upgrade=spawnSync('node',['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env,encoding:'utf8'});expect(upgrade.status,upgrade.stderr).toBe(0);
  const result=spawnSync(process.execPath,['tests/helpers/operations-account-runner.ts'],{env,encoding:'utf8',timeout:30000});expect(result.status,result.stdout+result.stderr).toBe(0);expect(result.stdout).toContain('Operations account persistence passed');
 }finally{rmSync(dir,{recursive:true,force:true});}
},60000);
