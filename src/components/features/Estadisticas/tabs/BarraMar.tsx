import React from "react";

export const BarraMar = ({val, max=100, t}: any) => (
  <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{flex:1,height:5,background:t.surf2,borderRadius:3,overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,(val/max)*100)}%`,height:"100%",background:val>=20?t.green:val>=10?t.amber:t.red,borderRadius:3,transition:"width 0.4s ease"}}/>
    </div>
    <span style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:11,fontWeight:700,color:val>=20?t.green:val>=10?t.amber:t.red,minWidth:42}}>{val.toFixed(1)}%</span>
  </div>
);
