const {onRequest}=require('firebase-functions/v2/https');
const {defineString}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {createCloudHandler}=require('./handler');
initializeApp();
const apiKey=defineString('STORE_WEB_API_KEY');
const productBucket=defineString('STORE_PRODUCT_BUCKET');
const extraOrigins=defineString('STORE_EXTRA_ORIGINS',{default:''});
exports.storeApi=onRequest({region:'asia-south1',minInstances:0,maxInstances:2,memory:'256MiB',timeoutSeconds:60},async(req,res)=>{
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  const origins=[`https://${project}.web.app`,`https://${project}.firebaseapp.com`,...extraOrigins.value().split(',').map(s=>s.trim()).filter(Boolean)];
  const handler=createCloudHandler({db:getFirestore(),auth:getAuth(),bucket:getStorage().bucket(productBucket.value()),apiKey:apiKey.value(),origins});
  return handler(req,res);
});
