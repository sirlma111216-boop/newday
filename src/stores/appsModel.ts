export type AppEntry={id:string;name:string;site:string;github:string;alternateSites:string[]};
export type AppsData={version:1;items:AppEntry[]};
export const emptyApps=():AppsData=>({version:1,items:[]});
export function webAddress(raw:string):string { if(!raw.trim())return ''; const text=raw.trim();const url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(text)?text:'https://'+text); if(url.protocol!=='https:'||url.username||url.password)throw new Error('https 웹 주소를 입력해 주세요.');return url.href; }
export function parseApps(value:unknown):AppsData{
 const v=value as AppsData;if(!v||v.version!==1||!Array.isArray(v.items)||v.items.length>2000)throw new Error('앱 목록 형식을 확인해 주세요.');
 const ids=new Set<string>();const text=(v:unknown,max=2000)=>{if(typeof v!=='string'||v.length>max)throw new Error('앱 정보 형식을 확인해 주세요.');return v;};
 return {version:1,items:v.items.map(item=>{const id=text(item.id,100);if(!id||ids.has(id))throw new Error('중복 앱 항목입니다.');ids.add(id);if(!Array.isArray(item.alternateSites)||item.alternateSites.length>10)throw new Error('추가 배포 주소를 확인해 주세요.');return {id,name:text(item.name,300),site:webAddress(text(item.site)),github:webAddress(text(item.github)),alternateSites:item.alternateSites.map(s=>webAddress(text(s)))};})};
}
export function searchApps(items:AppEntry[],query:string){const q=query.trim().toLowerCase();return items.filter(i=>[i.name,i.site,i.github,...i.alternateSites].join(' ').toLowerCase().includes(q));}
