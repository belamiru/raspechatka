"use client";
import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { DEFAULT_PRINT_SETTINGS, getDraftSettingsStorageKey, getPageColorMode, getPagePaperFormat, getPrintablePageCount, type ColorMode, type FilePrintSettings } from "@/lib/print-settings";
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
const THUMBNAIL_SCALE=0.28, PREVIEW_SCALE=1.5;
async function draw(pdf:PDFDocumentProxy,n:number,canvas:HTMLCanvasElement,scale:number){const p=await pdf.getPage(n),v=p.getViewport({scale}),c=canvas.getContext("2d",{alpha:false});if(!c)throw new Error("Браузер не поддерживает предпросмотр PDF.");canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);await p.render({canvas,canvasContext:c,viewport:v}).promise;}
const colorLabel:Record<ColorMode,string>={"black-and-white":"Ч/б",color:"Цвет", "solid-color":"Заливка"};
function Thumb({pdf,n,selected,included,format,color,onClick}:{pdf:PDFDocumentProxy;n:number;selected:boolean;included:boolean;format:"A4"|"A3";color:ColorMode;onClick:()=>void}){
  const cardRef=useRef<HTMLButtonElement>(null),canvasRef=useRef<HTMLCanvasElement>(null);
  const [isNearViewport,setIsNearViewport]=useState(false);

  useEffect(()=>{
    const card=cardRef.current;
    if(!card)return;
    const observer=new IntersectionObserver(([entry])=>setIsNearViewport(entry.isIntersecting),{rootMargin:"800px 0px"});
    observer.observe(card);
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!isNearViewport||!canvas)return;
    let disposed=false;
    let renderTask:ReturnType<PDFPageProxy["render"]>|null=null;
    void (async()=>{
      try{
        const page=await pdf.getPage(n);
        if(disposed)return;
        const viewport=page.getViewport({scale:THUMBNAIL_SCALE});
        const context=canvas.getContext("2d",{alpha:false});
        if(!context)throw new Error("Браузер не поддерживает предпросмотр PDF.");
        canvas.width=Math.ceil(viewport.width);
        canvas.height=Math.ceil(viewport.height);
        renderTask=page.render({canvas,canvasContext:context,viewport});
        await renderTask.promise;
      }catch{}
    })();
    return()=>{
      disposed=true;
      renderTask?.cancel();
      canvas.width=0;
      canvas.height=0;
    };
  },[isNearViewport,pdf,n]);

  return <button ref={cardRef} type="button" onClick={onClick} aria-pressed={selected} className={`rounded-xl border p-2 text-left ${selected?"border-blue-700 bg-blue-50":"border-slate-200 bg-white"} ${included?"":"opacity-50"}`}><div className="relative overflow-hidden rounded-lg bg-slate-100">{isNearViewport?<canvas ref={canvasRef} className="block h-auto w-full"/>:<div className="aspect-[0.707] w-full"/>}{!included&&<span className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-xs font-bold text-white">Не печатать</span>}{included&&(format==="A3"||color!=="black-and-white")&&<span className="absolute right-1 top-1 flex gap-1">{format==="A3"&&<b className="rounded bg-amber-500 px-1 py-0.5 text-xs text-white">A3</b>}{color!=="black-and-white"&&<b className={`rounded px-1 py-0.5 text-xs text-white ${color==="solid-color"?"bg-fuchsia-700":"bg-blue-700"}`}>{colorLabel[color]}</b>}</span>}</div><span className={`mt-2 block text-center text-xs font-bold ${included?"":"text-red-700 line-through"}`}>Страница {n}</span></button>
}
export function PrintDraftViewer({draftId}:{draftId:string}){const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(""),[current,setCurrent]=useState(1),[selected,setSelected]=useState<Set<number>>(new Set()),[settings,setSettings]=useState<FilePrintSettings>({...DEFAULT_PRINT_SETTINGS,defaults:{...DEFAULT_PRINT_SETTINGS.defaults},pageOverrides:{}});const preview=useRef<HTMLCanvasElement>(null);
useEffect(()=>{try{const x=localStorage.getItem(getDraftSettingsStorageKey(draftId));if(x)setSettings(JSON.parse(x))}catch{}let disposed=false;let loaded:PDFDocumentProxy|null=null;void(async()=>{try{const res=await fetch(`/api/print-drafts/${draftId}/preview`,{cache:"no-store"});if(!res.ok)throw new Error((await res.json().catch(()=>null))?.error??"Не удалось открыть документ.");loaded=await pdfjs.getDocument({data:await res.arrayBuffer()}).promise;if(!disposed)setPdf(loaded)}catch(e){if(!disposed)setError(e instanceof Error?e.message:"Не удалось открыть документ.")}})();return()=>{disposed=true;if(loaded)void loaded.destroy()}},[draftId]);
useEffect(()=>{localStorage.setItem(getDraftSettingsStorageKey(draftId),JSON.stringify(settings))},[draftId,settings]);useEffect(()=>{if(pdf&&preview.current)void draw(pdf,current,preview.current,PREVIEW_SCALE).catch(()=>setError("Не удалось показать страницу."))},[pdf,current]);
const update=(pages:number[],changes:{included?:boolean;paperFormat?:"A4"|"A3"|null;colorMode?:ColorMode|null})=>setSettings(old=>{const pageOverrides={...old.pageOverrides};for(const n of pages){const next={...(pageOverrides[n]??{pageNumber:n})};if(changes.included!==undefined)next.included=changes.included;if(changes.paperFormat===null)delete next.paperFormat;else if(changes.paperFormat)next.paperFormat=changes.paperFormat;if(changes.colorMode===null)delete next.colorMode;else if(changes.colorMode)next.colorMode=changes.colorMode;if(next.included!==false&&!next.paperFormat&&!next.colorMode)delete pageOverrides[n];else pageOverrides[n]=next}return {...old,pageOverrides}});
if(error)return <main className="min-h-screen bg-slate-50 p-6"><p className="rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</p></main>;if(!pdf)return <main className="min-h-screen bg-slate-50 p-10 text-center font-bold">Подготавливаем предпросмотр…</main>;const pages=Array.from({length:pdf.numPages},(_,i)=>i+1),inc=(n:number)=>settings.pageOverrides[n]?.included!==false,chosen=selected.size?[...selected]:[current];const toggle=(n:number)=>{setSelected(x=>{const y=new Set(x);y.has(n)?y.delete(n):y.add(n);return y});setCurrent(n)};return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4"><div><p className="font-black">Предпросмотр печати</p><p className="text-sm text-slate-500">Печатать: {getPrintablePageCount(pdf.numPages,settings)} из {pdf.numPages} стр.</p></div><button type="button" onClick={()=>window.close()} className="rounded-xl border px-4 py-2 text-sm font-bold">Сохранить и закрыть</button></div></header><div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[1fr_360px]"><section><div className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setSelected(new Set(pages))} className="rounded-lg border px-3 py-2 text-sm font-bold">Выбрать все</button><button type="button" onClick={()=>setSelected(new Set())} className="rounded-lg border px-3 py-2 text-sm font-bold">Снять выделение</button><button type="button" disabled={!selected.size} onClick={()=>update(chosen,{included:false})} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Не печатать</button><button type="button" disabled={!selected.size} onClick={()=>update(chosen,{included:true})} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Вернуть в печать</button></div><div className="mb-3 rounded-xl bg-white p-3"><p className="mb-2 text-sm font-bold">Формат и цвет выбранных</p><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>update(chosen,{paperFormat:"A4"})} className="rounded-lg border px-3 py-2 text-sm font-bold">A4</button><button type="button" onClick={()=>update(chosen,{paperFormat:"A3"})} className="rounded-lg border px-3 py-2 text-sm font-bold">A3</button><button type="button" onClick={()=>update(chosen,{colorMode:"black-and-white"})} className="rounded-lg border px-3 py-2 text-sm font-bold">Ч/б</button><button type="button" onClick={()=>update(chosen,{colorMode:"color"})} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-800">Цвет</button><button type="button" onClick={()=>update(chosen,{colorMode:"solid-color"})} className="rounded-lg border border-fuchsia-300 px-3 py-2 text-sm font-bold text-fuchsia-800">Цвет: заливка</button><button type="button" onClick={()=>update(chosen,{paperFormat:null,colorMode:null})} className="rounded-lg border px-3 py-2 text-sm font-bold">Вернуть настройки файла</button></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{pages.map(n=><Thumb key={n} pdf={pdf} n={n} selected={selected.has(n)} included={inc(n)} format={getPagePaperFormat(n,settings)} color={getPageColorMode(n,settings)} onClick={()=>toggle(n)}/>)}</div></section><aside className="h-fit rounded-2xl bg-white p-4 shadow-sm"><p className="font-bold">Страница {current}</p><p className="text-sm text-slate-500">{getPagePaperFormat(current,settings)} · {colorLabel[getPageColorMode(current,settings)]}</p><canvas ref={preview} className="mt-3 block h-auto max-w-full rounded bg-slate-100"/><button type="button" onClick={()=>update([current],{included:!inc(current)})} className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold text-white ${inc(current)?"bg-red-700":"bg-emerald-700"}`}>{inc(current)?"Не печатать эту страницу":"Вернуть в печать"}</button></aside></div></main>}
