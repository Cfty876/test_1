/** Re-encoding strips photo metadata; the original is never sent to the server. */
export interface AvatarCrop {x:number;y:number;zoom:number}
export async function compressAvatar(file:File,crop:AvatarCrop={x:.5,y:.5,zoom:1}):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw new Error('Выберите JPG, PNG или WebP размером до 15 МБ.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('Не удалось прочитать фотографию.');
  const canvas=document.createElement('canvas');const context=canvas.getContext('2d');if(!context)throw new Error('Браузер не поддерживает обработку фотографий.');
  const side=Math.min(image.naturalWidth,image.naturalHeight)/Math.max(1,Math.min(4,crop.zoom));
  const left=Math.max(0,Math.min(1,crop.x))*(image.naturalWidth-side);const top=Math.max(0,Math.min(1,crop.y))*(image.naturalHeight-side);
  for(const size of [384,320,256,192,128]){
   canvas.width=size;canvas.height=size;context.fillStyle='#ffffff';context.fillRect(0,0,size,size);context.drawImage(image,left,top,side,side,0,0,size,size);
   for(const quality of [.86,.76,.66]){
    let blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(blob?.type==='image/png')blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(blob&&['image/webp','image/jpeg'].includes(blob.type)&&blob.size<=16384){return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Не удалось обработать фотографию.'));reader.readAsDataURL(blob);});}
   }
  }
  throw new Error('Не удалось достаточно сжать фотографию. Выберите другой снимок.');
 }catch(error){throw new Error(error instanceof Error?error.message:'Не удалось открыть фотографию.');}finally{URL.revokeObjectURL(url);}
}
