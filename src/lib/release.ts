export type Release = {name:string;symbol:string;description:string;website:string;twitter:string;token:string;hash:string;block:string;proof:string;brainCommit:string;hits:number;buyTaxBps:number;sellTaxBps:number};

// The publisher creates this record only after checking the receipt and replay.
// Reject partial records so a malformed response cannot become a launch claim.
export function isRelease(value: unknown): value is Release {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  const hash = (v: unknown) => typeof v === 'string' && /^[a-f\d]{64}$/i.test(v);
  const tax = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10000;
  return ['name','symbol','description','website','twitter'].every(k => typeof r[k] === 'string')
    && typeof r.token === 'string' && /^0x[a-f\d]{40}$/i.test(r.token)
    && typeof r.hash === 'string' && /^0x[a-f\d]{64}$/i.test(r.hash)
    && typeof r.block === 'string' && /^[1-9]\d*$/.test(r.block)
    && hash(r.proof) && hash(r.brainCommit) && r.hits === 8 && tax(r.buyTaxBps) && tax(r.sellTaxBps);
}
