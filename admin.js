document.querySelector('#reload-admin').addEventListener('click',()=>window.location.reload());
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog=[],ordersList=[],cover='',images=[],pendingUploads=0;
let authMode='local',authConfigReady,showTrash=false;
const form=$('#product-form');
function selectAdminView(view){document.body.dataset.adminView=view;document.querySelectorAll('[data-admin-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.adminView===view)));}
document.querySelectorAll('[data-admin-view]').forEach(button=>button.addEventListener('click',()=>selectAdminView(button.dataset.adminView)));
selectAdminView('products');
function status(message){$('#status').textContent=message;}
async function api(url,options={}){const res=await window.KiddoAPI.fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await res.json();if(!res.ok){if([401,403].includes(res.status)){$('#manager').hidden=true;$('#login-panel').hidden=false;$('#logout').hidden=true;}throw new Error(data.error||'Unable to complete request.');}return data;}
function post(url,data){return api(url,{method:'POST',body:JSON.stringify(data)});}
const picture=p=>(p.image.startsWith('https:')||p.image.startsWith('/uploads/')||p.image.startsWith('assets/'))?p.image:'assets/'+p.image+'.svg';
function previewDiscount(){const price=Number(form.elements.price.value)||0,discount=Number(form.elements.discount_percent.value)||0;$('#discount-preview').textContent='Customer price: ৳'+(Math.round(price*(100-discount))/100).toLocaleString('en-BD');}
form.elements.price.addEventListener('input',previewDiscount);form.elements.discount_percent.addEventListener('input',previewDiscount);
function previews(){
 $('#cover-preview').innerHTML=cover?`<img src="${esc(cover)}" alt="Cover photo">`:'<p class="help">Choose a cover photo for this product.</p>';
 $('#gallery-preview').innerHTML=images.map((url,i)=>`<div><img src="${esc(url)}" alt="Gallery photo ${i+1}"><button type="button" data-remove-image="${i}" aria-label="Remove gallery photo ${i+1}">×</button></div>`).join('');
}
function edit(product){if(product)selectAdminView('editor');form.reset();form.elements.id.value=product?.id||'';if(product){for(const key of ['name','price','category','description','badge','sku','discount_percent'])form.elements[key].value=product[key]||'';form.elements.colors.value=(product.colors||[]).join(', ');form.elements.active.checked=product.active!==false;cover=picture(product);images=product.images||[];}else{cover='';images=[];}$('#editor-title').textContent=product?'Edit product':'Add product';$('#trash-product').hidden=!product||Boolean(product.deleted);previews();previewDiscount();}
async function load(){
 const [products,orders]=await Promise.all([api('/api/admin/products'),api('/api/admin/orders')]);catalog=products;ordersList=orders;
 $('#login-panel').hidden=true;$('#manager').hidden=false;$('#logout').hidden=false;
 renderProductList();
 renderOrders();
}
function renderOrders(){
 const filter=$('#order-filter').value,orders=ordersList.filter(o=>filter==='All'||o.status===filter);
 $('#orders').innerHTML=orders.length?orders.map(o=>`<details class="admin-order" ${o.status==='Pending confirmation'?'open':''}><summary>${esc(o.id)} · ৳${o.total.toLocaleString('en-BD')} · ${esc(o.status)}</summary><p>${esc(new Date(o.createdAt).toLocaleString())}</p><p><strong>${esc(o.customer.name)}</strong><br>${esc(o.customer.phone)}<br>${esc(o.customer.email)}<br>${esc(o.customer.address)}, ${esc(o.customer.city)} ${esc(o.customer.postalCode)}</p><ul>${o.items.map(i=>`<li>${esc(i.name)}${i.color?' ('+esc(i.color)+')':''} × ${i.quantity} · ৳${i.price}</li>`).join('')}</ul><p>Shipping: ${esc(o.shipping.label)} · ৳${o.shipping.price}<br>Payment: ${esc(o.payment)}<br>Notes: ${esc(o.customer.notes)}</p><div class="order-actions">${o.status==='Pending confirmation'?`<button data-order="${esc(o.id)}" data-order-status="Confirmed">Confirm order</button>`:''}${o.status==='Confirmed'?`<button data-order="${esc(o.id)}" data-order-status="Shipped">Mark as shipped</button>`:''}${o.status==='Shipped'?`<button data-order="${esc(o.id)}" data-order-status="Delivered">Mark as delivered</button>`:''}${o.status==='Pending confirmation'?`<button class="danger-button" data-order="${esc(o.id)}" data-order-status="Cancelled">Cancel order</button>`:''}${o.status==='Cancelled'?`<button data-order="${esc(o.id)}" data-order-status="Pending confirmation">Restore order</button>`:''}${['Delivered','Cancelled'].includes(o.status)?`<button class="danger-button" data-delete-order="${esc(o.id)}">Delete permanently</button>`:''}</div></details>`).join(''):'<p class="help">No orders in this category. Choose All orders to see the complete list.</p>';
}
$('#order-filter').addEventListener('change',renderOrders);
$('#orders').addEventListener('click',async e=>{const remove=e.target.closest('[data-delete-order]');if(remove){if(!window.confirm('Permanently delete order '+remove.dataset.deleteOrder+' and its customer information? This cannot be undone.'))return;remove.disabled=true;try{await post('/api/admin/order-delete',{receipt:remove.dataset.deleteOrder});await load();status('Order permanently deleted from the database.');}catch(error){status(error.message.includes('delete_delivered_store_order')?'Run cancelled-orders.sql in Supabase first.':error.message);remove.disabled=false;}return;}const b=e.target.closest('[data-order-status]');if(!b)return;b.disabled=true;try{await post('/api/admin/order-status',{receipt:b.dataset.order,status:b.dataset.orderStatus});$('#order-filter').value=b.dataset.orderStatus;await load();status(b.dataset.orderStatus==='Delivered'?'Order completed and moved to Delivered orders.':'Order updated to '+b.dataset.orderStatus+'.');}catch(error){status(error.message.includes('set_store_order_status')?'Run cancelled-orders.sql in Supabase first.':error.message);b.disabled=false;}});
$('#admin-product-search').addEventListener('input',renderProductList);
function renderProductList(){
 const query=$('#admin-product-search').value.trim().toLowerCase();const visible=catalog.filter(p=>Boolean(p.deleted)===showTrash&&`${p.name} ${p.sku||'KTM-'+p.id} ${p.id}`.toLowerCase().includes(query));
 $('#show-products').textContent=`Products (${catalog.filter(p=>!p.deleted).length})`;
 $('#show-trash').textContent=`Trash (${catalog.filter(p=>p.deleted).length})`;
 $('#show-products').setAttribute('aria-pressed',String(!showTrash));$('#show-trash').setAttribute('aria-pressed',String(showTrash));
 $('#product-list').innerHTML=visible.map(p=>`<div class="product-entry"><button type="button" class="product-row" data-edit="${p.id}" ${p.deleted?'disabled':''}><img src="${esc(picture(p))}" alt=""><span><strong>${esc(p.name)}</strong><small>${esc(p.sku||'KTM-'+p.id)} · ৳${p.price.toLocaleString('en-BD')} · ${esc(p.category)} · ${p.deleted?'In Trash':p.active===false?'Hidden':'Visible'}</small></span><span>${p.deleted?'':'Edit →'}</span></button><button type="button" class="${p.deleted?'restore-button':'delete-button'}" data-state-id="${p.id}" data-trash="${!p.deleted}">${p.deleted?'Restore':'Delete'}</button>${p.deleted?`<button type="button" class="delete-button" data-permanent-id="${p.id}">Delete permanently</button>`:''}</div>`).join('')||`<p class="help">${showTrash?'Trash is empty.':'No products yet. Choose Add product to start.'}</p>`;
}
async function deletePermanently(id,button){
 const product=catalog.find(p=>p.id===id);if(!product?.deleted)return;
 if(!window.confirm('Permanently delete "'+product.name+'" ('+(product.sku||'KTM-'+id)+')? This cannot be undone.'))return;
 button.disabled=true;
 try{await post('/api/admin/product-delete',{id});await load();if(Number(form.elements.id.value)===id)edit();status('Product permanently deleted.');}
 catch(error){status(error.message.includes('delete_trashed_store_product')?'Run permanent-delete.sql in the Supabase SQL Editor first, then try again.':error.message);button.disabled=false;}
}
async function changeProductState(id,deleted){
 if(pendingUploads)return;
 try{await post('/api/admin/product-state',{id,deleted});if(!deleted)showTrash=false;await load();if(Number(form.elements.id.value)===id)edit();status(deleted?'Moved to Trash. Open Trash to restore this product.':'Product restored and visible in the store. Refresh the storefront to see it.');}catch(error){status(error.message.includes('deleted')||error.message.includes('sku')?'Run the product management SQL update in Supabase first, then refresh this page.':error.message);}
}
$('#show-products').onclick=()=>{showTrash=false;renderProductList();};$('#show-trash').onclick=()=>{showTrash=true;renderProductList();};
$('#trash-product').onclick=()=>changeProductState(Number(form.elements.id.value),true);
async function upload(file){if(file.size>5*1024*1024)throw new Error('Each photo must be 5 MB or smaller.');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose JPG, PNG or WebP photos.');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});return (await post('/api/admin/upload',{base64})).url;}
async function uploadFiles(event,gallery){const files=[...event.target.files];if(!files.length)return;if(gallery&&images.length+files.length>10){status('You can add up to ten gallery photos.');return;}pendingUploads++;$('#save-product').disabled=true;try{status('Uploading photos…');if(gallery){for(const file of files)images.push(await upload(file));}else cover=await upload(files[0]);previews();status('Photos uploaded. Save the product to publish your changes.');}catch(e){previews();status(e.message);}finally{pendingUploads--;$('#save-product').disabled=pendingUploads>0;event.target.value='';}}
$('#cover-file').addEventListener('change',e=>uploadFiles(e,false));$('#gallery-files').addEventListener('change',e=>uploadFiles(e,true));
$('#gallery-preview').addEventListener('click',e=>{const b=e.target.closest('[data-remove-image]');if(b){images.splice(Number(b.dataset.removeImage),1);previews();}});
$('#product-list').addEventListener('click',e=>{if(pendingUploads)return;const permanentButton=e.target.closest('[data-permanent-id]');if(permanentButton){deletePermanently(Number(permanentButton.dataset.permanentId),permanentButton);return;}const stateButton=e.target.closest('[data-state-id]');if(stateButton){changeProductState(Number(stateButton.dataset.stateId),stateButton.dataset.trash==='true');return;}const b=e.target.closest('[data-edit]');if(b){const product=catalog.find(p=>p.id===Number(b.dataset.edit));if(product.deleted)return;edit(product);form.scrollIntoView({behavior:'smooth',block:'start'});}});
$('#new-product').onclick=()=>{if(pendingUploads)return;selectAdminView('editor');edit();form.scrollIntoView({behavior:'smooth'});};
$('#refresh').onclick=async()=>{
 const button=$('#refresh');button.disabled=true;button.textContent='Refreshing…';$('#orders').setAttribute('aria-busy','true');
 try{ordersList=await api('/api/admin/orders',{cache:'no-store'});renderOrders();status('Orders refreshed.');}
 catch(error){status('Could not refresh orders: '+error.message);}
 finally{button.disabled=false;button.textContent='Refresh orders';$('#orders').removeAttribute('aria-busy');}
};
function clearLoginError(){const error=$('#login-error');error.hidden=true;error.textContent='';for(const name of ['email','password'])$('#login-form').elements[name].removeAttribute('aria-invalid');}
function hidePassword(){const input=$('#admin-password'),button=$('#toggle-password');input.type='password';button.setAttribute('aria-label','Show password');button.setAttribute('aria-pressed','false');button.querySelector('.eye-slash').setAttribute('hidden','');}
$('#toggle-password').addEventListener('click',()=>{const input=$('#admin-password'),button=$('#toggle-password'),visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-label',visible?'Hide password':'Show password');button.setAttribute('aria-pressed',String(visible));button.querySelector('.eye-slash').toggleAttribute('hidden',!visible);});
$('#login-form').addEventListener('input',clearLoginError);
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();clearLoginError();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{await authConfigReady;const values=new FormData(e.target);await post('/api/admin/login',{email:values.get('email'),password:values.get('password')});hidePassword();e.target.reset();await load();status('Signed in.');}catch(error){hidePassword();const invalid=/invalid.*(credential|password|email)|incorrect.*(password|email)|wrong.*(password|email)/i.test(error.message);const alert=$('#login-error');alert.textContent=invalid?'Invalid email or password. Please try again.':error.message;alert.hidden=false;if(invalid)for(const name of ['email','password'])e.target.elements[name].setAttribute('aria-invalid','true');}finally{button.disabled=false;}});
$('#logout').onclick=async()=>{try{await post('/api/admin/logout',{});location.reload();}catch(e){status(e.message);}};
form.addEventListener('submit',async e=>{e.preventDefault();if(pendingUploads)return;if(!cover){status('Upload a cover photo first.');return;}const data=Object.fromEntries(new FormData(form));data.id=data.id?Number(data.id):undefined;data.colors=[...new Set(String(data.colors||'').split(',').map(c=>c.trim()).filter(Boolean))];data.price=Number(data.price);data.discount_percent=Number(data.discount_percent||0);data.active=form.elements.active.checked;data.image=cover;data.images=images;$('#save-product').disabled=true;try{const saved=await post('/api/admin/products',data);await load();edit(saved);status('Product saved. Refresh the storefront to see it.');}catch(error){status(error.message.includes('discount_percent')?'Run product-discounts.sql in Supabase first, then save again.':error.message);}finally{$('#save-product').disabled=false;}});
edit();
authConfigReady=api('/api/config').then(config=>{
 authMode=config.authMode;const firebase=['firebase','supabase'].includes(authMode);
 $('#admin-email-label').hidden=!firebase;$('#login-form').elements.email.required=firebase;
 if(firebase){$('#login-help').hidden=true;$('#login-form').querySelector('label:nth-of-type(2)').firstChild.textContent='Password';}
 return config;
});
authConfigReady.then(()=>load()).catch(error=>{if(!error.message.includes('sign in')&&!error.message.includes('session'))status(error.message);});
