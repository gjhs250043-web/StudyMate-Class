const express=require("express");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const app=express();
const PORT=process.env.PORT||3000;
const DB=path.join(__dirname,"data.json");

const INITIAL={
  users:[
    {id:"s1",name:"최성국",password:"1234",role:"student"},
    {id:"s2",name:"이현찬",password:"1234",role:"student"},
    {id:"s3",name:"정혁",password:"1234",role:"student"},
    {id:"s4",name:"한태웅",password:"1234",role:"student"},
    {id:"t1",name:"이수빈",password:"1234",role:"teacher"}
  ],
  notices:[],attendance:[],messages:[]
};

function load(){
  try{
    if(!fs.existsSync(DB)){save(JSON.parse(JSON.stringify(INITIAL)));return JSON.parse(JSON.stringify(INITIAL));}
    const d=JSON.parse(fs.readFileSync(DB,"utf8"));
    d.messages=d.messages||[]; d.notices=d.notices||[]; d.attendance=d.attendance||[];
    return d;
  }catch(e){return JSON.parse(JSON.stringify(INITIAL));}
}
function save(d){fs.writeFileSync(DB,JSON.stringify(d,null,2));}
function id(){return crypto.randomBytes(20).toString("hex");}

const sessions=new Map();
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

function auth(req,res,next){
  const t=(req.headers.authorization||"").replace(/^Bearer\s+/,"");
  const u=sessions.get(t);
  if(!u)return res.status(401).json({error:"로그인이 필요합니다."});
  req.user=u;next();
}
function teacher(req,res,next){
  if(req.user.role!=="teacher")return res.status(403).json({error:"선생님 계정만 사용할 수 있습니다."});
  next();
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"StudyMate Class"}));

app.post("/api/login",(req,res)=>{
  const d=load();
  const u=d.users.find(x=>x.name===String(req.body.name||"")&&x.password===String(req.body.password||""));
  if(!u)return res.status(401).json({error:"이름 또는 비밀번호가 올바르지 않습니다."});
  const t=id(), safe={id:u.id,name:u.name,role:u.role};
  sessions.set(t,safe);
  res.json({token:t,user:safe});
});
app.get("/api/me",auth,(req,res)=>res.json(req.user));

app.get("/api/notices",auth,(req,res)=>{
  const d=load();
  res.json([...d.notices].sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||String(b.createdAt).localeCompare(String(a.createdAt))));
});
app.post("/api/notices",auth,teacher,(req,res)=>{
  const title=String(req.body.title||"").trim(),content=String(req.body.content||"").trim();
  if(!title||!content)return res.status(400).json({error:"제목과 내용을 입력하세요."});
  const d=load();
  d.notices.push({id:id(),title,content,pinned:!!req.body.pinned,author:req.user.name,createdAt:new Date().toISOString()});
  save(d);res.json({ok:true});
});
app.delete("/api/notices/:id",auth,teacher,(req,res)=>{
  const d=load();d.notices=d.notices.filter(x=>x.id!==req.params.id);save(d);res.json({ok:true});
});

app.post("/api/attendance",auth,(req,res)=>{
  if(req.user.role!=="student")return res.status(403).json({error:"학생 계정만 출석할 수 있습니다."});
  const d=load(),date=new Date().toISOString().slice(0,10);
  if(!d.attendance.some(x=>x.userId===req.user.id&&x.date===date)){
    d.attendance.push({id:id(),userId:req.user.id,name:req.user.name,date,time:new Date().toISOString()});
    save(d);
  }
  res.json({ok:true});
});
app.get("/api/my-attendance",auth,(req,res)=>res.json(load().attendance.filter(x=>x.userId===req.user.id)));
app.get("/api/teacher/attendance",auth,teacher,(req,res)=>{
  const d=load(),date=String(req.query.date||new Date().toISOString().slice(0,10));
  res.json({date,students:d.users.filter(u=>u.role==="student").map(u=>{
    const r=d.attendance.find(a=>a.userId===u.id&&a.date===date);
    return {name:u.name,attended:!!r,record:r||null};
  })});
});

app.get("/api/messages",auth,(req,res)=>res.json(load().messages.slice(-100)));
app.post("/api/messages",auth,(req,res)=>{
  const text=String(req.body.text||"").trim();
  if(!text)return res.status(400).json({error:"메시지를 입력하세요."});
  if(text.length>300)return res.status(400).json({error:"메시지는 300자 이하로 입력하세요."});
  const d=load();
  d.messages.push({id:id(),userId:req.user.id,name:req.user.name,role:req.user.role,text,createdAt:new Date().toISOString()});
  if(d.messages.length>500)d.messages=d.messages.slice(-500);
  save(d);res.json({ok:true});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`StudyMate Class v6 running on port ${PORT}`));
