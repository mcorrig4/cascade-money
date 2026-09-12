import { readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const address = /^0x[0-9a-fA-F]{40}$/, hash = /^0x[0-9a-fA-F]{64}$/;
type Deployment = {chainId:number; vault:string; usdc:string; rpcUrl:string; explorer:string};
type Run = {chainId:number;vault:string;amount:string;actors:{name:string;address:string}[];transactions:{label:string;hash:string;status:string}[]};
export function parseOnchain(deployment:Deployment, runs:Run[], report:string, readme:string, vaultSource:string) {
  if(deployment.chainId!==5042002 || !address.test(deployment.vault) || !address.test(deployment.usdc)) throw Error('Invalid Arc deployment');
  const candidates=runs.filter(r=>r.chainId===deployment.chainId && r.vault.toLowerCase()===deployment.vault.toLowerCase() && r.transactions.length===16);
  const run=candidates.find(r=>r.transactions.every(t=>report.includes(t.hash)));
  if(!run || run.amount!=='10.0' || run.actors.length!==5) throw Error('Missing complete recorded 16-transaction run');
  if(new Set(run.transactions.map(t=>t.hash)).size!==16 || !run.transactions.every(t=>hash.test(t.hash)&&t.status==='success')) throw Error('Invalid demo receipts');
  if(!run.actors.every(a=>address.test(a.address)&&report.includes(`${a.name}: \`${a.address}\``))) throw Error('Actor/report mismatch');
  if(!report.includes('deficit == 0') || !report.includes('final principal balance passed on-chain')) throw Error('Missing recorded balance-sheet check');
  const command=readme.match(/^node scripts\/demo\.mjs --live --broadcast --seed <testnet-seed>$/m)?.[0];
  if(!command) throw Error('README live command missing');
  const steps=['Gas funding Apple','Gas funding Foxconn','Gas funding TSMC','Gas funding Corning','Gas funding Glass supplier','Principal funding Apple','Apple approves vault','Foxconn registers invoice','TSMC registers invoice','Corning registers invoice','Glass supplier registers invoice','Apple issues to Foxconn','Foxconn pays TSMC','TSMC pays Corning','Corning extends +90 to +120','Corning pays glass supplier'];
  if(!run.transactions.every((t,i)=>t.label===steps[i]) || !report.includes('5 × 0.1')) throw Error('Recorded story shape changed; review amount/date mapping');
  return { chainId:deployment.chainId,vault:deployment.vault,usdc:deployment.usdc,rpcUrl:deployment.rpcUrl,
    sourceUrl:`${deployment.explorer}/address/${deployment.vault}#code`,
    actors:run.actors.map((a,i)=>({...a,role:i===0?'Principal depositor / buyer':`Supplier ${i}`,url:`${deployment.explorer}/address/${a.address}`})),
    transactions:run.transactions.map((t,i)=>({...t,step:i+1,amount:i<5?'0.1':'10',unit:'USDC',
      date:i<7?null:i===14?'Run day +90 → +120':i===10||i===15?'Run day +120':'Run day +90',url:`${deployment.explorer}/tx/${t.hash}`})),
    recorded:{usdc:'10000000',principal:'10000000',settled:'40000000',deficit:'0',principalMatched:true,supplies:[{offset:90,amount:'0'},{offset:120,amount:'10000000'}]},
    // Absolute date IDs are absent from the manifests: recover them from the extension calldata on live read.
    supplyView:vaultSource.includes('public supplyByDate')?'eb274347':null,
    extensionTransaction:run.transactions[14].hash,
    command:`cd contracts\n${command}`,faucet:'https://faucet.circle.com/',
    reportUrl:'https://github.com/mcorrig4/cascade-money/blob/main/contracts/deployments/testnet-demo-run.md',
    readmeUrl:'https://github.com/mcorrig4/cascade-money/blob/main/contracts/README.md#live-deployment-explicit-opt-in' };
}
export async function generateOnchain() {
  const root=new URL('../../contracts/',import.meta.url), files=await readdir(new URL('deployments/',root));
  const read=(path:string)=>readFile(new URL(path,root),'utf8');
  const [deployment,report,readme,source,...runs]=await Promise.all([read('deployments/5042002.json'),read('deployments/testnet-demo-run.md'),read('README.md'),read('src/CascadeVault.sol'),...files.filter(f=>/^demo-5042002-.*\.json$/.test(f)).map(f=>read(`deployments/${f}`))]);
  const result=parseOnchain(JSON.parse(deployment),runs.map(r=>JSON.parse(r)),report,readme,source);
  await writeFile(new URL('../src/data/onchain.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(`Prepared Arc evidence: ${result.transactions.length} receipts, ${result.actors.length} actors`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await generateOnchain();
