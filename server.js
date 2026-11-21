const express=require('express'),fs=require('fs'),path=require('path'),crypto=require('crypto'),QR=require('qrcode');
const app=express();app.set('trust proxy',true);app.use(express.json({limit:'20kb'}));app.use(express.static(path.join(__dirname,'public')));
const DATA=process.env.DATA_FILE||path.join(__dirname,'results.json');const PASS=process.env.TEACHER_PASSWORD||'CHANGE_ME_BEFORE_DEPLOY';
const QUESTIONS=[
{kk:'Мен күн сайын мектепке баруым керек.',words:['I','have to','go','to','school','every day.'],answer:['I','have to','go','to','school','every day.']},
{kk:'Ол (ұл бала) ерте тұруы керек.',words:['He','has to','get up','early.'],answer:['He','has to','get up','early.']},
{kk:'Біз жексенбі күні мектепке баруға міндетті емеспіз.',words:['We',"don't have to",'go','to school','on Sunday.'],answer:['We',"don't have to",'go','to school','on Sunday.']},
{kk:'Ол (қыз бала) бүгін тамақ пісіруге міндетті емес.',words:['She',"doesn't have to",'cook','today.'],answer:['She',"doesn't have to",'cook','today.']},
{kk:'Оқушылар үй тапсырмасын орындауы керек.',words:['Students','have to','do','their homework.'],answer:['Students','have to','do','their homework.']}
];
let db={students:{}};try{db=JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{};if(!db.students)db.students={};
function save(){fs.mkdirSync(path.dirname(DATA),{recursive:true});fs.writeFileSync(DATA,JSON.stringify(db,null,2))}
function auth(req,res,next){if(req.get('x-teacher-password')!==PASS)return res.status(401).json({error:'Құпиясөз қате'});next()}
app.get('/api/questions',(req,res)=>res.json(QUESTIONS.map(q=>({kk:q.kk,words:q.words}))));
app.post('/api/join',(req,res)=>{let name=String(req.body.name||'').trim().slice(0,60);if(name.length<2)return res.status(400).json({error:'Аты-жөніңізді жазыңыз'});let id=crypto.randomUUID(),token=crypto.randomBytes(24).toString('hex');db.students[id]={id,name,token,answers:[],score:0,joined:Date.now()};save();res.json({id,token})});
app.post('/api/answer',(req,res)=>{let s=db.students[req.body.id];if(!s||s.token!==req.body.token)return res.status(403).json({error:'Кіруге рұқсат жоқ'});let i=s.answers.length;if(i>=QUESTIONS.length)return res.status(409).json({error:'Ойын аяқталды',score:s.score});let answer=req.body.answer;if(!Array.isArray(answer)||answer.length!==QUESTIONS[i].answer.length||!answer.every(v=>typeof v==='string'))return res.status(400).json({error:'Барлық сөзді орналастырыңыз'});let correct=answer.every((v,j)=>v===QUESTIONS[i].answer[j]);s.answers.push({correct,submitted:Date.now()});if(correct)s.score++;save();res.json({correct,score:s.score,next:i+1,finished:i+1===QUESTIONS.length})});
app.get('/api/state',(req,res)=>{let s=db.students[req.query.id];if(!s||s.token!==req.query.token)return res.status(403).json({error:'Сессия табылмады'});res.json({name:s.name,next:s.answers.length,score:s.score,finished:s.answers.length===QUESTIONS.length})});
app.get('/api/results',auth,(req,res)=>res.json(Object.values(db.students).map(({id,name,score,answers,joined})=>({id,name,score,completed:answers.length,finished:answers.length===QUESTIONS.length,joined})).sort((a,b)=>b.score-a.score||b.completed-a.completed)));
app.get('/api/qr',auth,async(req,res)=>{try{let url=`${req.protocol}://${req.get('host')}/`;res.type('png');res.send(await QR.toBuffer(url,{width:360,margin:2}))}catch(e){res.status(500).end()}});
app.get('/teacher',(req,res)=>res.sendFile(path.join(__dirname,'public','teacher.html')));
app.delete('/api/student-by-name', auth, (req, res) => {const name = String(req.body.name || '').trim();
const matches = Object.entries(db.students).filter( ([id, student]) => student.name === name );if (matches.length !== 1) {return res.status(409).json({error: 'Оқушы табылмады немесе осы атпен бірнеше оқушы бар',
count: matches.length }); }
delete db.students[matches[0][0]]; save(); res.json({ success: true });});
app.listen(process.env.PORT||3000,()=>console.log('Grammar Quest server running'));
