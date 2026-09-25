import type {Manifest} from '../lib/api';
export default function LaunchEconomics({value,onChange,disabled}:{value:Manifest;onChange:(v:Partial<Manifest>)=>void;disabled:boolean}){
 const tax=value.flapTax;
 return <fieldset className="economics" disabled={disabled}><legend>Flap 发行参数 · BNB</legend>
 <div className="form-grid"><label>开发者预买（BNB）<input readOnly value="0"/></label><label>最高总支出（BNB）<input required inputMode="decimal" placeholder="创建费＋Gas 总上限" value={value.maxTotalBnb||''} onChange={e=>onChange({maxTotalBnb:e.target.value||null})}/></label></div>
 <p className="field-hint">零预买。预算仅用于本次创建和 Gas，不授权后续交易。</p>
 {tax?<><div className="form-grid"><label>买入税率<input readOnly value={`${tax.buyBps/100}%`}/></label><label>卖出税率<input readOnly value={`${tax.sellBps/100}%`}/></label></div>
 <label>税收受益钱包<input readOnly value={tax.beneficiary}/></label>
 <p className="field-hint">平台扣费后的税收全部流向该钱包。无额外集成商佣金、销毁、分红或流动性分配；实际净收入不是交易额的 2%。</p>
 <div className="form-grid"><label>税率有效期（天）<input type="number" min={1} max={36500} required value={tax.taxDuration/86400} onChange={e=>onChange({flapTax:{...tax,taxDuration:Number(e.target.value)*86400}})}/></label><label>反套利窗口（秒）<input type="number" min={0} max={86400} required value={tax.antiFarmerDuration} onChange={e=>onChange({flapTax:{...tax,antiFarmerDuration:Number(e.target.value)}})}/></label></div>
 <p className="field-hint">当前草稿为 100 年税期、1 小时反套利窗口；签名前请复核。这是 Flap 参数，并非原项目已有参数。</p></>:<p className="error-text">请载入已保存的 Flap 参数。</p>}
 <details><summary>官网与社交链接</summary>{([{key:'webUrl',label:'Website'},{key:'twitterUrl',label:'X profile'},{key:'telegramUrl',label:'Telegram'}] as const).map(({key,label})=><label key={key}>{label}<input type="url" placeholder="https://" value={value[key]||''} onChange={e=>onChange({[key]:e.target.value})}/></label>)}</details>
 </fieldset>
}
