/** Bounded line diff. Large changed blocks fall back to exact replace-all rows, not guessed matches. */
export function lineDiff(before,after,{maxCells=500000,maxRows=2000,context=3}={}){
  if(typeof before!=='string'||typeof after!=='string')throw new TypeError('Diff requires text');
  for(const [n,min]of [[maxCells,1],[maxRows,1],[context,0]])if(!Number.isSafeInteger(n)||n<min)throw new RangeError('Invalid diff budget');
  if(before.length+after.length>8000000)throw new RangeError('Diff source budget exceeded');
  const a=before===''?[]:before.match(/[^\n]*\n|[^\n]+$/g),b=after===''?[]:after.match(/[^\n]*\n|[^\n]+$/g);let head=0,tail=0;
  while(head<Math.min(a.length,b.length)&&a[head]===b[head])head++;
  while(tail<Math.min(a.length,b.length)-head&&a[a.length-1-tail]===b[b.length-1-tail])tail++;
  const aa=a.slice(head,a.length-tail),bb=b.slice(head,b.length-tail),n=aa.length,m=bb.length,rows=[];let old=1,next=1,truncated=false,coarse=(n+1)*(m+1)>maxCells;
  const emit=(kind,text)=>{const row={kind,text,beforeLine:kind==='add'?null:old,afterLine:kind==='remove'?null:next};if(kind!=='add')old++;if(kind!=='remove')next++;if(rows.length<maxRows)rows.push(row);else truncated=true;};
  if(head>context){rows.push({kind:'gap',text:(head-context)+' unchanged lines'});old=next=head-context+1;}
  for(let i=Math.max(0,head-context);i<head;i++)emit('equal',a[i]);
  if(!coarse){const dp=new Uint32Array((n+1)*(m+1)),at=(i,j)=>i*(m+1)+j;
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[at(i,j)]=aa[i]===bb[j]?dp[at(i+1,j+1)]+1:Math.max(dp[at(i+1,j)],dp[at(i,j+1)]);
    let i=0,j=0;while(i<n||j<m){if(i<n&&j<m&&aa[i]===bb[j]){emit('equal',aa[i++]);j++;}else if(i<n&&(j===m||dp[at(i+1,j)]>=dp[at(i,j+1)]))emit('remove',aa[i++]);else emit('add',bb[j++]);}
  }else{for(const line of aa)emit('remove',line);for(const line of bb)emit('add',line);}
  for(let i=0;i<Math.min(context,tail);i++)emit('equal',a[a.length-tail+i]);
  if(tail>context&&rows.length<maxRows)rows.push({kind:'gap',text:(tail-context)+' unchanged lines'});
  return {rows,coarse,truncated,beforeLines:a.length,afterLines:b.length};
}
