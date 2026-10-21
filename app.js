const products = window.KIDDO_PRODUCTS;
// Add your own image paths here in the order you want them displayed.
// The first photo stays on the card until the shopper clicks an arrow.
const extraPhotos = {
  301: ['Se1d683a505084308bac83e165b0971feK.webp'],
  302: ['Sdb8fcf1acb2d4e85967a37c2a14e49b8N.webp'],
  303: ['S3542775ef34e4872905145bdd1181e0eb.webp'],
  305: ['S161bb8c9a8bd4c1082d2b56715492ffcc.webp'],
  306: ['Se9e14ed17aa1491a820cc5dc199238f69.webp'],
  307: ['S4e8f50fdd80e421cafc577d303e8adab9.webp'],
  308: ['S550f5cec9c5940c0bb31409d61a4ce02D.webp'],
  309: ['S644c74f926234d4f92442e6f39facddes.webp'],
  310: ['S951f8d04857f469ab99a6cf96e98768fC.webp'],
  311: ['Sf4e79a576bc44e26b1c93f5cf6ecda260.webp'],
  312: ['S7c875824ee4645ec983662d044a6fdedR.webp']
};
const gallery = p => [photo(p), ...(p.images || extraPhotos[p.id] || []).map(src => src.startsWith('http') || src.startsWith('assets/') || src.startsWith('/uploads/') ? src : 'https://toysmartbd.shop/cdn/shop/files/' + src + '?width=900')];
const cardImages = {};
const safeText = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = n => '৳' + n.toLocaleString('en-BD');
const priceMarkup=p=>p.discount_percent>0?`<span class="sale-price">${money(p.price)}</span> <del class="original-price">${money(p.originalPrice)}</del> <span class="discount-tag">${p.discount_percent}% OFF</span>`:money(p.price);
const photo = (p,w=700) => (p.image.startsWith('https://') || p.image.startsWith('/uploads/') || p.image.startsWith('assets/')) ? p.image : `assets/${p.image}.svg`;
let cart = {};
const cartKey=(id,color='')=>color?`${id}~${encodeURIComponent(color)}`:String(id);
function getCartLines(){return Object.entries(cart).flatMap(([key,quantity])=>{const [id,encoded='']=key.split('~');const p=products.find(p=>p.id===Number(id));if(!p)return [];let color;try{color=decodeURIComponent(encoded);}catch{return [];}if(color&&!(p.colors||[]).includes(color))return [];return [{...p,key,color,quantity}];});}
try {const saved=JSON.parse(localStorage.getItem('kiddo-catalog-v2-cart')||'{}');for(const [key,quantity] of Object.entries(saved)){if(Number.isInteger(quantity)&&quantity>0)cart[key]=Math.min(99,quantity);}const valid=getCartLines();cart=Object.fromEntries(valid.map(p=>[cartKey(p.id,p.color||(p.colors||[])[0]||''),p.quantity]));}catch{}
const categoryMatches=(product,value)=>value==='All'||product.category===value||(value==='Vehicles'&&['Cars','Cycles'].includes(product.category))||(value==='Learning'&&product.category==='Puzzles');
let category='All';
let searchMode=false;
const grid=document.querySelector('#products');
function renderProducts(){
  const search=document.querySelector('#search').value.toLowerCase().trim();
  const min=searchMode?Math.max(0,Number(document.querySelector('#price-min').value)||0):0;
  const max=searchMode?Math.max(0,Number(document.querySelector('#price-max').value)||0):Infinity;
  let list=products.filter(p=>p.price>=min&&p.price<=max&&categoryMatches(p,category)&&`${p.name} ${p.sku||'KTM-'+p.id} ${p.id} ${p.category} ${p.description}`.toLowerCase().includes(search));
  const sort=document.querySelector('#sort').value;
  if(sort!=='featured')list.sort((a,b)=>sort==='low'?a.price-b.price:b.price-a.price);
  grid.innerHTML=list.map(p=>`<article class="product"><div class="product-image"><a href="#product-${p.id}" class="product-photo-link" aria-label="View ${safeText(p.name)}"><img src="${gallery(p)[cardImages[p.id] || 0]}" alt="${safeText(p.name)}" loading="lazy"></a><div class="card-actions"><button type="button" class="quick-eye" data-quick="${p.id}" aria-label="Quick view ${safeText(p.name)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button><button type="button" class="card-favorite" data-card-favorite="${p.id}" aria-label="Add ${safeText(p.name)} to favorites" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button></div>${p.discount_percent>0?`<span class="card-discount">-${p.discount_percent}%</span>`:''}${p.badge?`<span class="badge">${safeText(p.badge)}</span>`:''}${gallery(p).length>1?`<button class="card-arrow card-prev" data-image="${p.id}" data-step="-1" aria-label="Previous photo of ${safeText(p.name)}">‹</button><button class="card-arrow card-next" data-image="${p.id}" data-step="1" aria-label="Next photo of ${safeText(p.name)}">›</button>`:''}</div><div class="product-meta"><h3><a href="#product-${p.id}">${safeText(p.name)}</a></h3><p class="card-sku">SKU: ${safeText(p.sku||'KTM-'+p.id)}</p><div class="card-bottom"><span class="price">${priceMarkup(p)}</span><button type="button" class="card-buy" data-quick="${p.id}" aria-label="Choose and buy ${safeText(p.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h3l3 13h11l3-9H6"/><circle cx="10" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg></button></div></div></article>`).join('')||'<p class="empty">No toys found. Try another search or category.</p>';
  document.querySelector('#results').textContent=`${list.length} toy${list.length===1?'':'s'} to explore`;
}
function setCategory(value){category=value;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===value);b.setAttribute('aria-pressed',String(b.dataset.filter===value));});renderProducts();}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.filter)));
document.querySelectorAll('[data-category]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#search').value='';setCategory(a.dataset.category);}));
document.querySelector('#search').addEventListener('input',renderProducts);
document.querySelector('#sort').addEventListener('change',renderProducts);
let toastTimer;
function notify(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2400);}
function renderCart(){
  const count=Object.values(cart).reduce((a,b)=>a+b,0);
  document.querySelector('#cart-count').textContent=count;
  document.querySelector('#bag-count').textContent=`(${count})`;
  document.querySelector('#cart-items').innerHTML=getCartLines().map(p=>`<div class="cart-row"><img src="${photo(p,200)}" alt="${safeText(p.name)}"><div class="cart-detail"><h3>${safeText(p.name)}</h3><p>${money(p.price)}${p.color?` · ${safeText(p.color)}`:''}</p><div class="quantity"><button data-change="${safeText(p.key)}" data-delta="-1" aria-label="Decrease ${safeText(p.name)} quantity">−</button><span>${p.quantity}</span><button data-change="${safeText(p.key)}" data-delta="1" aria-label="Increase ${safeText(p.name)} quantity">+</button></div></div><button class="remove" data-remove="${safeText(p.key)}" aria-label="Remove ${safeText(p.name)}">Remove</button></div>`).join('')||'<p class="empty">Your bag is waiting for a little fun.</p>';
  const total=getCartLines().reduce((sum,p)=>sum+p.price*p.quantity,0);
  document.querySelector('#cart-summary').innerHTML=(count?`<div class="subtotal"><span>Subtotal</span><span>${money(total)}</span></div><p class="cart-note">Shipping is calculated at checkout. Pay when your order arrives.</p>`:'')+(count?'<a class="checkout-link" href="#checkout">Proceed to checkout →</a>':'')+'<button class="continue" id="continue">Continue exploring</button>';
  document.querySelector('#continue').onclick=()=>document.querySelector('#cart').close();
}
function saveCart(){try{localStorage.setItem('kiddo-catalog-v2-cart',JSON.stringify(cart));}catch{notify('Your bag is available for this visit. Browser storage is unavailable.');}renderCart();}
function addToCart(id,quantity=1,color){const p=products.find(p=>p.id===id);if(!p)return;const selected=color===undefined?((activeProduct?.id===id?selectedColor:'')||(p.colors||[])[0]||''):color;if((p.colors||[]).length&&!p.colors.includes(selected)){notify('Please choose an available color.');return false;}const key=cartKey(id,selected);if((cart[key]||0)+quantity>99){notify('Maximum quantity is 99.');return false;}cart[key]=(cart[key]||0)+quantity;saveCart();notify('Added to your bag');return true;}

grid.addEventListener('click',e=>{
  const arrow=e.target.closest('[data-image]');
  if(arrow){const p=products.find(p=>p.id===Number(arrow.dataset.image));const images=gallery(p);cardImages[p.id]=((cardImages[p.id]||0)+Number(arrow.dataset.step)+images.length)%images.length;const card=arrow.closest('.product');card.querySelector('img').src=images[cardImages[p.id]];return;}
  const b=e.target.closest('[data-add]');if(b)addToCart(Number(b.dataset.add));
});
document.querySelector('#cart-items').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.remove)delete cart[b.dataset.remove];else if(b.dataset.change){const id=b.dataset.change;cart[id]=Math.min(99,cart[id]+Number(b.dataset.delta));if(cart[id]<=0)delete cart[id];}saveCart();});
document.querySelector('#open-cart').onclick=()=>document.querySelector('#cart').showModal();
document.querySelector('#close-cart').onclick=()=>document.querySelector('#cart').close();
document.querySelector('#cart').addEventListener('click',e=>{if(e.target===e.currentTarget&&e.clientX<e.currentTarget.getBoundingClientRect().left)e.currentTarget.close();});
setCategory('All');renderCart();

const detail = document.querySelector('#product-detail');
let activeProduct=null;
let detailImage=0;
let selectedColor='';
let activityTimer;
const randomInRange=(min,max)=>min+Math.floor(Math.random()*(max-min+1));
function showDetailImage(index){
  const images=gallery(activeProduct);detailImage=(index+images.length)%images.length;
  document.querySelector('#detail-main-image').src=images[detailImage];
  document.querySelector('#image-counter').textContent=`${detailImage+1} / ${images.length}`;
  detail.querySelectorAll('[data-thumb]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.thumb)===detailImage);b.setAttribute('aria-pressed',String(Number(b.dataset.thumb)===detailImage));});
}
const RECENT_KEY='kiddo-recently-viewed';
let recentIds=[];
try{const stored=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');if(Array.isArray(stored))recentIds=[...new Set(stored)].filter(id=>products.some(p=>p.id===id)).slice(0,12);}catch{}
function relatedProducts(p){
  const others=products.filter(item=>item.id!==p.id);
  return [...others.filter(item=>item.category===p.category),...others.filter(item=>item.category!==p.category)].slice(0,4);
}
function recommendationCard(p){return `<article class="recommendation-card"><a href="#product-${p.id}"><img src="${photo(p)}" alt="${safeText(p.name)}" loading="lazy"><h3>${safeText(p.name)}</h3><p>${priceMarkup(p)}</p></a></article>`;}
function recommendationSection(title,description,items,className){return `<section class="recommendations ${className}" aria-label="${title}"><h2>${title}</h2><p class="recommendation-intro">${description}</p>${items.length?`<div class="recommendation-grid">${items.map(recommendationCard).join('')}</div>`:'<p class="recent-empty">Products you explore will appear here. Open another product to start your list.</p>'}</section>`;}
function rememberProduct(id){recentIds=[id,...recentIds.filter(item=>item!==id)].slice(0,12);try{localStorage.setItem(RECENT_KEY,JSON.stringify(recentIds));}catch{}}
const FAVORITE_KEY='kiddo-favorites';
let favoriteIds=[];
try{const stored=JSON.parse(localStorage.getItem(FAVORITE_KEY)||'[]');if(Array.isArray(stored))favoriteIds=[...new Set(stored)].filter(id=>products.some(p=>p.id===id));}catch{}
const heartIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
function favoriteButton(p){const saved=favoriteIds.includes(p.id);return `<button class="detail-favorite ${saved?'is-saved':''}" id="detail-favorite" aria-pressed="${saved}" aria-label="${saved?'Remove from':'Add to'} favorites">${heartIcon}</button>`;}
function renderFavorites(){
  document.querySelector('#favorite-count').textContent=favoriteIds.length;
  document.querySelector('#open-favorites').setAttribute('aria-label',`Open favorites (${favoriteIds.length})`);
  document.querySelector('#favorite-items').innerHTML=favoriteIds.length?favoriteIds.map(id=>{const p=products.find(item=>item.id===id);return `<div class="favorite-row"><a href="#product-${p.id}"><img src="${photo(p)}" alt="${safeText(p.name)}"><span>${safeText(p.name)}<strong>${money(p.price)}</strong></span></a><button data-unfavorite="${p.id}" aria-label="Remove ${safeText(p.name)} from favorites">Remove</button></div>`;}).join(''):'<p class="empty">No favorites yet. Open a product and tap the heart to save it here.</p>';
}
function toggleFavorite(id){
  if(!products.some(p=>p.id===id))return;
  const wasSaved=favoriteIds.includes(id);favoriteIds=wasSaved?favoriteIds.filter(item=>item!==id):[id,...favoriteIds];
  try{localStorage.setItem(FAVORITE_KEY,JSON.stringify(favoriteIds));}catch{notify('Favorites are saved for this visit only.');}
  renderFavorites();
  if(activeProduct){const button=document.querySelector('#detail-favorite');if(button){const saved=favoriteIds.includes(activeProduct.id);button.classList.toggle('is-saved',saved);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',`${saved?'Remove from':'Add to'} favorites`);}}
  notify(wasSaved?'Removed from favorites':'Added to favorites');
}
function renderDetail(p){
  activeProduct=p;detailImage=0;selectedColor=(p.colors||[])[0]||'';const images=gallery(p);
  const title=p.name;
  const question='https://wa.me/8801610288554?text='+encodeURIComponent('Hello Kiddo Toy Mart, I have a question about '+p.name+' ('+(p.sku||'KTM-'+p.id)+').');
  detail.innerHTML=`<div class="breadcrumbs"><a href="#collection">Home / Collection</a><span>/</span><span>${safeText(p.name)}</span><a class="collection-grid-link" href="#collection" aria-label="Back to all products">▦</a></div><div class="detail-layout"><div class="detail-gallery"><div class="detail-image-wrap"><img id="detail-main-image" src="${images[0]}" alt="${safeText(p.name)}">${images.length>1?'<button class="gallery-prev" data-gallery-step="-1" aria-label="Previous product image">‹</button><button class="gallery-next" data-gallery-step="1" aria-label="Next product image">›</button>':''}<span class="zoom-hint">⌕ Hover to zoom</span><span id="image-counter" aria-live="polite">1 / ${images.length}</span></div><div class="detail-thumbs">${images.map((src,i)=>`<button data-thumb="${i}" class="${i===0?'selected':''}" aria-pressed="${i===0}" aria-label="View product photo ${i+1}"><img src="${src}" alt="${safeText(p.name)} photo ${i+1}"></button>`).join('')}</div></div><div class="detail-info"><p class="detail-brand">Kiddo Toy Mart</p><h1 tabindex="-1">${safeText(title)}</h1><p class="sales-activity">🔥 ${randomInRange(2,10)} sold in last 24 hours</p><p class="detail-price">${priceMarkup(p)}</p><div class="delivery-note">Estimate delivery times: <strong>Available Product 3–5 days, Pre Order 15–25 Days.</strong></div><p class="viewer-counter"><span><strong id="activity-viewers">${randomInRange(10,50)}</strong> people are viewing this right now</span></p>${(p.colors||[]).length?`<div class="color-picker"><p>Color: <strong id="chosen-color">${safeText(selectedColor)}</strong></p><div role="group" aria-label="Choose color">${p.colors.map((color,i)=>`<button type="button" data-color-index="${i}" aria-pressed="${i===0}">${safeText(color)}</button>`).join('')}</div></div>`:''}<div class="detail-tools"><a href="${question}" target="_blank" rel="noopener">☏ Ask on WhatsApp</a><a href="tel:+8801610288554">Call us</a><button id="share-product">Share product</button></div><div class="detail-purchase"><label class="detail-quantity">Quantity<span><button data-quantity="-1" aria-label="Decrease quantity">−</button><input id="detail-quantity" type="number" min="1" max="99" value="1" aria-label="Product quantity"><button data-quantity="1" aria-label="Increase quantity">+</button></span></label><button class="detail-add" id="detail-add">Add to cart</button>${favoriteButton(p)}</div><button class="buy-now" id="buy-now">Buy it now</button><p class="purchase-note">Cash on delivery. Your order is subject to stock confirmation.</p><dl class="product-facts"><dt>Product code</dt><dd>${safeText(p.sku||'KTM-'+p.id)}</dd><dt>Availability</dt><dd>Confirm with store</dd><dt>Collection</dt><dd>${safeText(p.category)}</dd></dl><details open><summary>Description</summary><p>${safeText(p.description)}</p><p>Contact us to confirm dimensions, material, recommended age, colors, and the exact item included before purchase.</p></details><details><summary>Shipping and returns</summary><p>Delivery charges, timelines, and return terms will be confirmed before we accept real orders.</p></details><details><summary>Contact the store</summary><p>Baridhara J block (Purobi Prangan), Notun Bazar, Vatara-1229<br><a href="tel:+8801610288554">+880 1610-288554</a><br><a href="mailto:Mahmudunnabishawon@gmail.com">Mahmudunnabishawon@gmail.com</a></p></details><a class="back-collection" href="#collection">← Back to collection</a></div></div>`;
  const recentlyViewed=recentIds.filter(id=>id!==p.id).map(id=>products.find(item=>item.id===id)).filter(Boolean).slice(0,8);
  detail.innerHTML+=recommendationSection('You May Also Like','Explore similar toys and a few more playtime favorites.',relatedProducts(p),'similar-products');
  detail.innerHTML+=recommendationSection('Recently Viewed','Pick up where you left off. Your browsing history is saved on this browser.',recentlyViewed,'recent-products');
  rememberProduct(p.id);
  activityTimer=setInterval(()=>{if(!document.hidden){const counter=document.querySelector('#activity-viewers');if(counter)counter.textContent=randomInRange(10,50);}},10000);
}
function updateRoute(){
  clearInterval(activityTimer);
  const checkout=location.hash==='#checkout';
  document.querySelector('#checkout-page').hidden=!checkout;
  document.body.classList.toggle('checkout-mode',checkout);
  if(checkout){detail.hidden=true;document.querySelector('#storefront').hidden=true;document.querySelector('#cart').close();activeProduct=null;window.renderCheckout({products,cart,money,photo,safeText,saveCart,getCartLines});document.title='Checkout | Kiddo Toy Mart';window.scrollTo(0,0);return;}

  const match=location.hash.match(/^#product-(\d+)$/);const p=match&&products.find(p=>p.id===Number(match[1]));
  searchMode=location.hash.startsWith('#search?');
  document.body.classList.toggle('search-mode',searchMode);
  document.querySelector('#search-intro').hidden=!searchMode;
  document.querySelector('#search-sidebar').hidden=!searchMode;
  if(searchMode){const query=new URLSearchParams(location.hash.slice(8)).get('q')||'';document.querySelector('#search').value=query;document.querySelector('#page-search').value=query;document.querySelector('#search-context').textContent=query?`Search results for “${query}”`:'Browse all products';setCategory('All');document.title='Search | Kiddo Toy Mart';window.scrollTo(0,0);}
  else if(!p){document.querySelector('#search').value='';renderProducts();}
  detail.hidden=!p;document.querySelector('#storefront').hidden=Boolean(p);
  if(p){renderDetail(p);document.title=p.name+' | Kiddo Toy Mart';window.scrollTo(0,0);detail.querySelector('h1').focus({preventScroll:true});}
  else{activeProduct=null;if(!searchMode)document.title='Kiddo Toy Mart — A little play. A big adventure.';if(match)notify('This product could not be found.');}
}
function selectedQuantity(){const input=document.querySelector('#detail-quantity');const q=Math.max(1,Math.min(99,Math.floor(Number(input.value)||1)));input.value=q;return q;}
detail.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||!activeProduct)return;
  if(b.dataset.colorIndex!==undefined){selectedColor=activeProduct.colors[Number(b.dataset.colorIndex)];document.querySelector('#chosen-color').textContent=selectedColor;detail.querySelectorAll('[data-color-index]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));}
  if(b.id==='detail-favorite')toggleFavorite(activeProduct.id);
  if(b.dataset.thumb!==undefined)showDetailImage(Number(b.dataset.thumb));
  if(b.dataset.galleryStep)showDetailImage(detailImage+Number(b.dataset.galleryStep));
  if(b.dataset.quantity){const input=document.querySelector('#detail-quantity');input.value=Math.max(1,Math.min(99,selectedQuantity()+Number(b.dataset.quantity)));}
  if(b.id==='detail-add'||b.id==='buy-now'){if(addToCart(activeProduct.id,selectedQuantity())&&b.id==='buy-now')location.hash='#checkout';}
  if(b.id==='share-product'){try{await navigator.clipboard.writeText(location.href);notify('Product link copied');}catch{notify('Copy the product link from your address bar.');}}
});
window.addEventListener('hashchange',updateRoute);
updateRoute();

function submitSearch(value){const next='#search?q='+encodeURIComponent(value.trim());if(location.hash===next)updateRoute();else location.hash=next;}
document.querySelector('#header-search-form').addEventListener('submit',e=>{e.preventDefault();submitSearch(document.querySelector('#search').value);});
document.querySelector('#page-search-form').addEventListener('submit',e=>{e.preventDefault();submitSearch(document.querySelector('#page-search').value);});
function updatePriceFilter(){const min=Math.max(0,Number(document.querySelector('#price-min').value)||0);const max=Math.max(0,Number(document.querySelector('#price-max').value)||0);document.querySelector('#price-caption').textContent=`Price: ${money(min)} – ${money(max)}`;document.querySelector('#price-range').value=max;renderProducts();}
for(const selector of ['#price-min','#price-max'])document.querySelector(selector).addEventListener('input',updatePriceFilter);
document.querySelector('#price-range').addEventListener('input',e=>{document.querySelector('#price-max').value=e.target.value;updatePriceFilter();});
document.querySelector('#reset-price').addEventListener('click',()=>{document.querySelector('#price-min').value=0;document.querySelector('#price-max').value=Math.max(...products.map(p=>p.price));updatePriceFilter();});
const catalogMax=Math.ceil(Math.max(0,...products.map(p=>p.price)));document.querySelector('#price-max').value=catalogMax;document.querySelector('#price-range').max=catalogMax;document.querySelector('#price-range').value=catalogMax;document.querySelector('#price-caption').textContent=`Price: ${money(0)} – ${money(catalogMax)}`;



document.querySelector('#open-favorites').addEventListener('click',()=>{renderFavorites();document.querySelector('#favorites').showModal();});
document.querySelector('#close-favorites').addEventListener('click',()=>document.querySelector('#favorites').close());
document.querySelector('#favorites').addEventListener('click',e=>{const remove=e.target.closest('[data-unfavorite]');if(remove){toggleFavorite(Number(remove.dataset.unfavorite));return;}if(e.target.closest('a'))document.querySelector('#favorites').close();});
renderFavorites();

document.querySelector('#cart').addEventListener('click',e=>{if(e.target.closest('a[href="#checkout"]'))document.querySelector('#cart').close();});

document.querySelector('#footer-favorites').addEventListener('click',()=>document.querySelector('#open-favorites').click());

window.addEventListener('pagehide',()=>clearInterval(activityTimer));

