import test from 'node:test';
import assert from 'node:assert/strict';
import {suppliedApps} from '../src/stores/appsSeed.ts';
import {parseApps,searchApps,webAddress} from '../src/stores/appsModel.ts';
import {createVault,openVault,sealVault,parseVault,searchSecrets} from '../src/stores/vaultCrypto.ts';
test('제공된 43개 앱을 빠짐없이 보존하고 이름과 GitHub를 추측하지 않는다',()=>{
 assert.equal(suppliedApps.items.length,43);assert.equal(suppliedApps.items[0].name,'');assert.equal(suppliedApps.items.find(i=>i.site.includes('noai.'))!.github,'');
 assert.equal(suppliedApps.items.find(i=>i.site.includes('reaction.'))!.site,'https://reaction.labbotory.com/');assert.equal(suppliedApps.items.find(i=>i.name==='출결노트')!.alternateSites[0],'https://tiny-churros-96c5a2.netlify.app/');
});
test('앱 검색은 이름·배포주소·GitHub·추가주소에 적용된다',()=>{
 for(const query of ['루미런','gamerun','gamerun.git','tiny-churros'])assert.ok(searchApps(suppliedApps.items,query).length>0);assert.equal(searchApps(suppliedApps.items,'NOAI').length,1);
});
test('바로가기 주소는 스크립트·로컬파일·자격증명 URL을 거부한다',()=>{
 for(const url of ['javascript:alert(1)','file:///test','https://user:pass@example.com'])assert.throws(()=>webAddress(url));assert.equal(webAddress('newday.labbitory.com'),'https://newday.labbitory.com/');
 assert.throws(()=>parseApps({version:1,items:[suppliedApps.items[0],suppliedApps.items[0]]}));
});
test('저장소는 암호화 후에만 직렬화하며 올바른 비밀번호로 복원된다',async()=>{
 const created=await createVault('test-master-passphrase-123');const contents={version:1 as const,items:[{id:'1',kind:'account' as const,label:'테스트',site:'example.com',username:'test-user',secret:'private-password-123',notes:'메모'},{id:'2',kind:'api' as const,label:'API',site:'example.net',username:'',secret:'secret-api-key-456',notes:''}]};
 const envelope=await sealVault(contents,created.key,created.salt);const raw=JSON.stringify(envelope);assert.ok(!raw.includes('private-password'));assert.ok(!raw.includes('secret-api'));assert.ok(!raw.includes('test-user'));
 assert.deepEqual((await openVault(envelope,'test-master-passphrase-123')).contents,contents);await assert.rejects(()=>openVault(envelope,'wrong-passphrase-123'));
 const second=await sealVault(contents,created.key,created.salt);assert.notEqual(second.iv,envelope.iv);assert.notEqual(second.ciphertext,envelope.ciphertext);
 const bytes=Uint8Array.from(atob(envelope.ciphertext),c=>c.charCodeAt(0));bytes[0]^=1;await assert.rejects(()=>openVault({...envelope,ciphertext:btoa(String.fromCharCode(...bytes))},'test-master-passphrase-123'));
 assert.equal(searchSecrets(contents.items,'account','TEST-USER').length,1);assert.equal(searchSecrets(contents.items,'account','private-password').length,0);assert.equal(searchSecrets(contents.items,'api','example').length,1);
});
test('암호화 저장소 형식과 짧은 잠금 비밀번호를 거부한다',async()=>{await assert.rejects(()=>createVault('short'));assert.throws(()=>parseVault({version:1,algorithm:'plain'}));});
