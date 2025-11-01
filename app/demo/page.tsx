"use client";
import { useState } from "react";

export default function Page(){
  const [file,setFile]=useState<File|null>(null);
  const [out,setOut]=useState<any>(null);
  const [busy,setBusy]=useState(false);

  async function onSubmit(e:any){
    e.preventDefault(); if(!file) return;
    setBusy(true); setOut(null);
    const fd=new FormData(); fd.append("file",file);
    const r=await fetch("/api/upload",{method:"POST",body:fd});
    const j=await r.json();
    setOut(j); setBusy(false);
  }

  function download(name:string, data:string){
    const blob=new Blob([data],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main style={{maxWidth:720,margin:"40px auto",padding:"0 16px",fontFamily:"system-ui"}}>
      <h1>MadeProof Demo — Upload & Verify</h1>
      <form onSubmit={onSubmit} encType="multipart/form-data">
        <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={e=>setFile(e.target.files?.[0]||null)} required />
        <button disabled={!file||busy} style={{marginLeft:8}}>{busy?"Verifying…":"Upload"}</button>
      </form>
      <p style={{fontSize:12,opacity:.7}}>Ephemeral: processed in memory, deleted immediately. Signed deletion receipt returned.</p>

      {out && (
        <section style={{marginTop:16,padding:12,border:"1px solid #ddd",borderRadius:8,background:"#fff"}}>
          {!out.ok && <p style={{color:"#c00"}}>Error: {out.error}</p>}
          {out.ok && (
            <>
              <div><b>File:</b> {out.name} ({out.mime})</div>
              <div><b>SHA-256:</b> {out.sha256}</div>
              <div><b>Processed:</b> {out.started_at}</div>
              <div><b>Deleted:</b> {out.deleted_at}</div>
              <details style={{marginTop:8}}>
                <summary>Extracted text (first 10k chars)</summary>
                <pre style={{whiteSpace:"pre-wrap"}}>{out.text || "(no text extracted)"}</pre>
              </details>
              <details style={{marginTop:8}}>
                <summary>Deletion receipt</summary>
                <pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(out.deletion_receipt,null,2)}</pre>
              </details>
              <details style={{marginTop:8}}>
                <summary>Signature (base64)</summary>
                <code style={{wordBreak:"break-all"}}>{out.signature_base64}</code>
              </details>
              <p style={{fontSize:12,opacity:.8}}>Verify with public key at <code>/api/public-key</code>.</p>

              <button
                style={{marginTop:8}}
                onClick={()=>{
                  const name=`MadeProof-Deletion-Receipt-${(out.sha256||"receipt").slice(0,12)}.json`;
                  download(name, JSON.stringify({receipt:out.deletion_receipt, signature_base64:out.signature_base64},null,2));
                  location.replace("/demo?cleared=1");
                }}
              >
                End Demo & Erase
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
