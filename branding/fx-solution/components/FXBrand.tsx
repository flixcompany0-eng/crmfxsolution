import type {CSSProperties} from 'react';
/** Apresentação somente. A lógica do novo CRM permanece independente. */
export function FXSymbol({className='',style}:{className?:string;style?:CSSProperties}) {
  return <svg className={'mark '+className} style={style} viewBox="0 0 64 64" fill="none" role="img" aria-label="FX Solution"><path d="M8 13H43L35 23H20L16 29H31L23 39H11L2 51L13 24Z" fill="currentColor"/><path d="M41 8L50 22L63 8H51L41 21L33 34L41 45L50 32L58 47H44L35 58L23 40Z" fill="currentColor"/></svg>;
}
export function FXBrand(){return <div className="brand"><FXSymbol/><span>FX <b>SOLUTION</b><small>OPERATION INTELLIGENCE</small></span></div>;}
