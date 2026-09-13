import { readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const address = /^0x[0-9a-fA-F]{40}$/, hash = /^0x[0-9a-fA-F]{64}$/;
type Deployment = {chainId:number; vault:string; usdc:string; rpcUrl:string; explorer:string;owner:string;transactionHash:string;sourceRevision:string};
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
  // The story's shape (buyer -> N suppliers -> extension -> final payment) is fixed by the
  // protocol demo; the actor NAMES are whatever this run recorded. Derive expected labels
  // from the run's own actors rather than hard-coding a specific supply-chain story.
  const [a0,a1,a2,a3,a4]=run.actors.map(a=>a.name);
  const fixedSteps=[`Gas funding ${a0}`,`Gas funding ${a1}`,`Gas funding ${a2}`,`Gas funding ${a3}`,`Gas funding ${a4}`,`Principal funding ${a0}`,`${a0} approves vault`];
  const labelsOk = run.transactions.slice(0,7).every((t,i)=>t.label===fixedSteps[i])
    && run.transactions.slice(7,11).every((t,i)=>t.label.startsWith(`${[a1,a2,a3,a4][i]} registers invoice`))
    && run.transactions[11].label===`${a0} issues to ${a1}`
    && run.transactions[12].label===`${a1} pays ${a2}`
    && run.transactions[13].label===`${a2} pays ${a3}`
    && run.transactions[14].label===`${a3} extends +90 to +120`
    && run.transactions[15].label===`${a3} pays ${a4}`;
  if(!labelsOk || !report.includes('5 × 0.1')) throw Error('Recorded story shape changed; review amount/date mapping');
  // Metadata examples are recorded in the same report section as this run's receipts.
  // Retain absolute fallback dates only when the two recorded reads corroborate each other.
  const runReport=report.split(/^## Run /m).find(section=>run.transactions.every(t=>section.includes(t.hash)))??report;
  const spotDate=runReport.match(/`uri\(today\)`[^\n]*Maturity: (\d{4}-\d{2}-\d{2}) \(UTC\)/)?.[1];
  const forwardDate=runReport.match(/`uri\(today\+30\)`[^\n]*Maturity: (\d{4}-\d{2}-\d{2}) \(UTC\)/)?.[1];
  const recordedDay=spotDate&&forwardDate&&Date.parse(`${forwardDate}T00:00:00Z`)-Date.parse(`${spotDate}T00:00:00Z`)===30*86400000?Math.floor(Date.parse(`${spotDate}T00:00:00Z`)/86400000):null;
  if(!address.test(deployment.owner)||!hash.test(deployment.transactionHash)||!/^([0-9a-f]{40})$/i.test(deployment.sourceRevision)) throw Error('Invalid deployment source evidence');
  return { owner:deployment.owner,deploymentTransaction:deployment.transactionHash,sourceRevision:deployment.sourceRevision,
    contractSourceUrl:`https://github.com/mcorrig4/cascade-money/blob/${deployment.sourceRevision}/contracts/src/CascadeVault.sol`,
    metadataSourceUrl:`https://github.com/mcorrig4/cascade-money/blob/${deployment.sourceRevision}/contracts/src/DateMetadata.sol`,
    chainId:deployment.chainId,vault:deployment.vault,usdc:deployment.usdc,rpcUrl:deployment.rpcUrl,
    sourceUrl:`${deployment.explorer}/address/${deployment.vault}#code`,
    actors:run.actors.map((a,i)=>({...a,role:i===0?'Principal depositor / buyer':`Supplier ${i}`,url:`${deployment.explorer}/address/${a.address}`})),
    transactions:run.transactions.map((t,i)=>({...t,step:i+1,amount:i<5?'0.1':'10',unit:'USDC',
      date:i<7?null:i===14?'Run day +90 → +120':i===10||i===15?'Run day +120':'Run day +90',url:`${deployment.explorer}/tx/${t.hash}`})),
    recorded:{day:recordedDay,usdc:'10000000',principal:'10000000',settled:'40000000',deficit:'0',principalMatched:true,supplies:[{offset:90,id:recordedDay===null?null:recordedDay+90,amount:'0'},{offset:120,id:recordedDay===null?null:recordedDay+120,amount:'10000000'}]},
    // Live reads recover and verify exact date IDs from the recorded extension calldata.
    supplyView:vaultSource.includes('public supplyByDate')?'eb274347':null,
    extensionTransaction:run.transactions[14].hash,
    command:`cd contracts\n${command}`,faucet:'https://faucet.circle.com/',
    reportUrl:'https://github.com/mcorrig4/cascade-money/blob/main/contracts/deployments/testnet-demo-run.md',
    readmeUrl:'https://github.com/mcorrig4/cascade-money/blob/main/contracts/README.md#live-deployment-explicit-opt-in' };
}
export async function generateOnchain() {
  const root=new URL('../../contracts/',import.meta.url);
  const read=(path:string)=>readFile(new URL(path,root),'utf8');
  const fixtureUrl=new URL('../src/data/demo-run.json',import.meta.url);
  let runs:string[];
  try {
    runs=[await readFile(fixtureUrl,'utf8')];
  } catch {
    const files=await readdir(new URL('deployments/',root));
    runs=await Promise.all(files.filter(f=>/^demo-5042002-.*\.json$/.test(f)).map(f=>read(`deployments/${f}`)));
  }
  const [deployment,report,readme,source]=await Promise.all([read('deployments/5042002.json'),read('deployments/testnet-demo-run.md'),read('README.md'),read('src/CascadeVault.sol')]);
  const result=parseOnchain(JSON.parse(deployment),runs.map(r=>JSON.parse(r)),report,readme,source);
  await writeFile(new URL('../src/data/onchain.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(`Prepared Arc evidence: ${result.transactions.length} receipts, ${result.actors.length} actors`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await generateOnchain();
