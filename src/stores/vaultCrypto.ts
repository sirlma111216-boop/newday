export type SecretEntry={id:string;kind:'account'|'api';label:string;site:string;username:string;secret:string;notes:string};
export type VaultContents={version:1;items:SecretEntry[]};
export type VaultEnvelope={version:1;algorithm:'AES-GCM';kdf:'PBKDF2-SHA256';iterations:600000;salt:string;iv:string;ciphertext:string};
const ITERATIONS=600000;
export const emptyVault=():VaultEnvelope|null=>null;
const encode=(bytes:Uint8Array)=>{let s='';for(const byte of bytes)s+=String.fromCharCode(byte);return btoa(s);};
const decode=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export function parseSecrets(value:unknown):VaultContents {
 const v=value as VaultContents;if(!v||v.version!==1||!Array.isArray(v.items)||v.items.length>2000)throw new Error('저장소 내용 형식이 올바르지 않습니다.');
 const ids=new Set<string>();return {version:1,items:v.items.map(i=>{if(!i||!['account','api'].includes(i.kind))throw new Error('저장 항목 구분 오류');const result={} as SecretEntry;for(const key of ['id','kind','label','site','username','secret','notes'] as const){if(typeof i[key]!=='string'||i[key].length>(key==='secret'||key==='notes'?10000:2000))throw new Error('저장 항목 형식 오류');(result as any)[key]=i[key];}if(!result.id||ids.has(result.id))throw new Error('중복 항목입니다.');ids.add(result.id);return result;})};
}
export function parseVault(value:unknown):VaultEnvelope|null {
 if(value===null)return null;const v=value as VaultEnvelope;
 if(!v||v.version!==1||v.algorithm!=='AES-GCM'||v.kdf!=='PBKDF2-SHA256'||v.iterations!==ITERATIONS)throw new Error('암호화 저장소 형식이 올바르지 않습니다.');
 for(const key of ['salt','iv','ciphertext'] as const)if(typeof v[key]!=='string'||v[key].length>1300000)throw new Error('암호화 데이터 형식 오류');
 if(decode(v.salt).length!==16||decode(v.iv).length!==12||decode(v.ciphertext).length<16)throw new Error('암호화 데이터 길이 오류');
 return {version:1,algorithm:'AES-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:v.salt,iv:v.iv,ciphertext:v.ciphertext};
}
export async function vaultKey(password:string,salt:string):Promise<CryptoKey>{
 const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:decode(salt),iterations:ITERATIONS},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function sealVault(contents:VaultContents,key:CryptoKey,salt:string):Promise<VaultEnvelope>{
 const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(parseSecrets(contents))));
 return {version:1,algorithm:'AES-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt,iv:encode(iv),ciphertext:encode(new Uint8Array(encrypted))};
}
export async function createVault(password:string){if(password.length<12)throw new Error('잠금 비밀번호는 12자 이상으로 정해 주세요.');const salt=encode(crypto.getRandomValues(new Uint8Array(16))),key=await vaultKey(password,salt);const contents:VaultContents={version:1,items:[]};return {key,salt,contents,envelope:await sealVault(contents,key,salt)};}
export async function openVault(envelope:VaultEnvelope,password:string){const v=parseVault(envelope)!;const key=await vaultKey(password,v.salt);try{const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(v.iv)},key,decode(v.ciphertext));return {key,salt:v.salt,contents:parseSecrets(JSON.parse(new TextDecoder().decode(raw)))};}catch{throw new Error('잠금 비밀번호가 다르거나 저장소 데이터가 손상되었습니다.');}}
export function searchSecrets(items:SecretEntry[],kind:SecretEntry['kind'],query:string){const q=query.trim().toLowerCase();return items.filter(i=>i.kind===kind&&[i.label,i.site,i.username,i.notes].join(' ').toLowerCase().includes(q));}
