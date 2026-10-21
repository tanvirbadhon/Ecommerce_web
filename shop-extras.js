/* Product quick view and a WhatsApp hand-off. No messages are sent automatically. */
(()=>{
 function syncCardHearts(){document.querySelectorAll('[data-card-favorite]').forEach(button=>{const id=Number(button.dataset.cardFavorite),saved=favoriteIds.includes(id),p=products.find(item=>item.id===id);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',(saved?'Remove ':'Add ')+(p?.name||'product')+(saved?' from favorites':' to favorites'));});}
 grid.addEventListener('click',e=>{const button=e.target.closest('[data-card-favorite]');if(button){toggleFavorite(Number(button.dataset.cardFavorite));syncCardHearts();}});
 new MutationObserver(syncCardHearts).observe(grid,{childList:true});
 new MutationObserver(syncCardHearts).observe(document.querySelector('#favorite-items'),{childList:true});
 syncCardHearts();
 const modal=document.createElement('dialog');modal.id='quick-view';modal.setAttribute('aria-labelledby','quick-title');document.body.append(modal);
 let toy=null,color='',imageIndex=0;
 function close(){modal.close();}
 function open(id){
  toy=products.find(p=>p.id===id);if(!toy)return;color=(toy.colors||[])[0]||'';imageIndex=0;
  const photos=gallery(toy);
  modal.innerHTML=`<button type="button" class="quick-close" aria-label="Close product preview">×</button><div class="quick-layout"><div class="quick-gallery"><img id="quick-photo" src="${photos[0]}" alt="${safeText(toy.name)}">${photos.length>1?`<div class="quick-thumbs">${photos.map((src,i)=>`<button type="button" data-quick-photo="${i}" aria-label="View photo ${i+1}" aria-pressed="${i===0}"><img src="${src}" alt=""></button>`).join('')}</div>`:''}</div><div class="quick-info"><p class="quick-brand">Kiddo Toy Mart</p><h2 id="quick-title">${safeText(toy.name)}</h2><p class="quick-price">${priceMarkup(toy)}</p><p class="help">Product ID: ${safeText(toy.sku||'KTM-'+toy.id)}</p>${toy.colors?.length?`<div class="quick-colors"><p>Color: <strong id="quick-color">${safeText(color)}</strong></p><div role="group" aria-label="Choose product color">${toy.colors.map((c,i)=>`<button type="button" data-quick-color="${i}" aria-pressed="${i===0}">${safeText(c)}</button>`).join('')}</div></div>`:''}<div class="quick-purchase"><div class="quick-quantity"><button type="button" data-quick-step="-1" aria-label="Decrease quantity">−</button><input id="quick-quantity" type="number" min="1" max="99" value="1" aria-label="Quantity"><button type="button" data-quick-step="1" aria-label="Increase quantity">＋</button></div><button type="button" id="quick-add">Add to cart</button></div><button type="button" id="quick-buy">Buy it now</button><p class="quick-delivery">Estimated delivery: <strong>Available Product 3–5 days, Pre Order 15–25 Days.</strong></p><h3>Product details</h3><p class="quick-description">${safeText(toy.description)}</p><a class="quick-full" href="#product-${toy.id}">View full details →</a></div></div>`;
  modal.showModal();modal.querySelector('.quick-info').scrollTop=0;
 }
 function quantity(){const input=modal.querySelector('#quick-quantity');const value=Math.max(1,Math.min(99,Math.floor(Number(input.value)||1)));input.value=value;return value;}
 grid.addEventListener('click',e=>{const button=e.target.closest('[data-quick]');if(button)open(Number(button.dataset.quick));});
 modal.addEventListener('click',e=>{
  if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();return;}
  if(e.target.closest('.quick-close,.quick-full')){close();return;}
  const b=e.target.closest('button');if(!b||!toy)return;
  if(b.dataset.quickPhoto!==undefined){imageIndex=Number(b.dataset.quickPhoto);modal.querySelector('#quick-photo').src=gallery(toy)[imageIndex];modal.querySelectorAll('[data-quick-photo]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));}
  if(b.dataset.quickColor!==undefined){color=toy.colors[Number(b.dataset.quickColor)];modal.querySelector('#quick-color').textContent=color;modal.querySelectorAll('[data-quick-color]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));}
  if(b.dataset.quickStep){const input=modal.querySelector('#quick-quantity');input.value=Math.max(1,Math.min(99,quantity()+Number(b.dataset.quickStep)));}
  if(b.id==='quick-add'||b.id==='quick-buy'){if(addToCart(toy.id,quantity(),color)){close();if(b.id==='quick-buy')location.hash='#checkout';}}
 });
 window.addEventListener('hashchange',()=>{if(modal.open)close();});
 // Zoom follows the mouse position inside the currently displayed image.
 function resetZoom(img){if(img){img.style.transform='';img.style.transformOrigin='';}}
 document.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse')return;
  const img=e.target.closest('#detail-main-image,#quick-photo');if(!img)return;
  const wrap=img.parentElement,r=wrap.getBoundingClientRect();
  const x=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));
  img.style.transformOrigin=x+'% '+y+'%';img.style.transform='scale(2.2)';
 });
 document.addEventListener('pointerout',e=>{const img=e.target.closest('#detail-main-image,#quick-photo');if(img)resetZoom(img);});
 const launcher=document.querySelector('.whatsapp-float');
 launcher.removeAttribute('target');launcher.setAttribute('role','button');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','whatsapp-panel');
 const panel=document.createElement('section');panel.id='whatsapp-panel';panel.hidden=true;panel.setAttribute('aria-label','Chat with Kiddo Toy Mart');
 panel.innerHTML=`<div class="chat-header"><span class="chat-avatar">KT</span><div><strong>Kiddo Toy Mart</strong><span>WhatsApp support</span></div><button type="button" class="chat-close" aria-label="Close chat panel">×</button></div><div class="chat-body"><div class="chat-greeting">👋 Hello! Welcome to Kiddo Toy Mart.<p>How can we help you today?</p><small>Choose a topic to start a WhatsApp chat.</small></div><div class="chat-topics" role="group" aria-label="Chat topic"><button type="button" data-topic="I would like help choosing toys for my child." aria-pressed="true">🧸 Find a toy</button><button type="button" data-topic="I need help with my order." aria-pressed="false">📦 Order help</button><button type="button" data-topic="Please tell me about delivery times and charges." aria-pressed="false">🚚 Delivery information</button></div></div><div class="chat-footer"><a id="chat-start" href="https://wa.me/8801610288554" target="_blank" rel="noopener">➤ Start chat</a><small>Opens WhatsApp. We’ll reply as soon as we can.</small></div>`;
 document.body.append(panel);
 function showChat(show){panel.hidden=!show;launcher.setAttribute('aria-expanded',String(show));if(show)panel.querySelector('.chat-close').focus();else launcher.focus();}
 function topic(message){panel.querySelector('#chat-start').href='https://wa.me/8801610288554?text='+encodeURIComponent('Hello Kiddo Toy Mart! '+message);}
 topic(panel.querySelector('[data-topic]').dataset.topic);
 launcher.addEventListener('click',e=>{e.preventDefault();showChat(panel.hidden);});
 launcher.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();showChat(panel.hidden);}});
 panel.querySelector('.chat-close').onclick=()=>showChat(false);
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-topic]');if(!b)return;topic(b.dataset.topic);panel.querySelectorAll('[data-topic]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)showChat(false);});
})();
