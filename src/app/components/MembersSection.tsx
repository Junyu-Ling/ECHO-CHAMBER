import { SectionHeader } from "./SectionHeader";
import kimPhoto from "../../imports/71f668c2a7fba05551d1d606f7d8071d.jpg";
import nancyPhoto from "../../imports/lQLPKdR7pV4uPB_NAmbNAbuwfOwc6P3wB3IJ8mfbtWyQAA_443_614.png";
import maikePhoto from "../../imports/25DC9DC1-439E-4229-AAD5-1B6E8BCA7B10.png";
import alexanderPhoto from "../../imports/ad81c106b9718346d60bf647dce4c108.jpg";
import mikePhoto from "../../imports/bcc1145200430316445221f235a19070.jpg";
import richardPhoto from "../../imports/member-richard.png";
import shenXinyuPhoto from "../../imports/member-shen-xinyu.png";
import { ImageWithFallback } from "./ImageWithFallback";

const members = [
  {
    id: 10,
    name: "龚晨炜",
    nameEn: "JACK",
    role: "指导老师",
    roleEn: "指导老师",
    bio: "乐队的灵魂导师和坚实后盾，见证每一次从排练室到舞台的蜕变",
    photo: "https://images.unsplash.com/photo-1544168190-79c17527004f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1hbGUlMjB0ZWFjaGVyJTIwYWR1bHR8ZW58MXx8fHwxNzgwMzEzODA2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    isLeader: true,
  },
  {
    id: 1,
    name: "袁紫嫣",
    nameEn: "KIM",
    role: "贝斯手 / 主唱",
    roleEn: "中国部 G11C2",
    bio: "乐队不可或缺的声音，用嗓音和低音在黑暗与光之间游走",
    photo: kimPhoto,
  },
  {
    id: 2,
    name: "刘邑阳",
    nameEn: "GORDEN",
    role: "电吉他手 / 鼓手",
    roleEn: "中国部 G11C2",
    bio: "他的riff像一把刀，划开沉默的夜晚，留下回声",
    photo: "https://images.unsplash.com/photo-1619612833026-d7ce3c1023d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHlvdW5nJTIwbWFsZSUyMGd1aXRhcmlzdHxlbnwxfHx8fDE3ODAzMTM4MDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: 3,
    name: "仲毅",
    nameEn: "MIKE",
    role: "吉他手",
    roleEn: "中国部 G11C2",
    bio: "吉他手 电木都玩，groove，乐队音乐，渴望纯粹的声音",
    photo: mikePhoto,
  },
  {
    id: 4,
    name: "陶梦泽",
    nameEn: "ALEXANDER",
    role: "键盘手",
    roleEn: "中国部 G11C2",
    bio: "全高中部唯一薛之谦真爱粉丝，立志于用键盘促进世界和平",
    photo: alexanderPhoto,
  },
  {
    id: 5,
    name: "解华乐",
    nameEn: "ELLIS",
    role: "主唱",
    roleEn: "中国部 G11C2",
    bio: "用歌声勾勒出音乐的灵魂，为乐曲注入无尽的氛围与色彩",
    photo: "https://images.unsplash.com/photo-1657830582172-b1eb2880f497?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHlvdW5nJTIwZmVtYWxlJTIwa2V5Ym9hcmRpc3R8ZW58MXx8fHwxNzgwMzEzODA1fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: 6,
    name: "韩羽畅",
    nameEn: "RICHARD",
    role: "鼓手 / 键盘手",
    roleEn: "中国部 G11C1",
    bio: "音色架构师，通过电子节拍与旋律，拉满现场的潮流暗黑质感",
    photo: richardPhoto,
  },
  {
    id: 7,
    name: "顾辰炀",
    nameEn: "GRACE",
    role: "主唱",
    roleEn: "中国部 G12C1",
    bio: "舞台上的光影捕手，用歌声传递着不屈的青春力量",
    photo: "https://images.unsplash.com/photo-1642692018315-3e8f09e80a61?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHlvdW5nJTIwZmVtYWxlJTIwZ3VpdGFyaXN0fGVufDF8fHx8MTc4MDMxMzgwNnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: 8,
    name: "胡钰沁",
    nameEn: "LANYA",
    role: "主唱 / 尤克里里",
    roleEn: "中国部 G12C1",
    bio: "空灵的声音，像夜空中的星光，点缀在主旋律的每一个角落",
    photo: "https://images.unsplash.com/photo-1513097633097-329a3a64e0d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHlvdW5nJTIwZmVtYWxlJTIwc3RhZ2V8ZW58MXx8fHwxNzgwMzEzODA2fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: 9,
    name: "沈鑫虞",
    nameEn: "STEVEN",
    role: "键盘手",
    roleEn: "中国部 G12C1",
    bio: "用沉稳的音符托起每一次情感的爆发，乐队坚实的后盾",
    photo: shenXinyuPhoto,
  },
  {
    id: 11,
    name: "葛铭茗",
    nameEn: "NANCY",
    role: "吉他手",
    roleEn: "中国部 G10C1",
    bio: "最没谱的吉他手，小猪手拨弦中",
    photo: nancyPhoto,
  },
  {
    id: 12,
    name: "白千禾",
    nameEn: "MAIKE",
    role: "键盘手（全能预备队员）",
    roleEn: "中国部 G10C2",
    bio: "在琴键上飞，在后台忙，哪里需要就往哪里钻的乐队万能补丁",
    photo: maikePhoto,
  },
  {
    id: 13,
    name: "黄紫依",
    nameEn: "WENNY",
    role: "主唱",
    roleEn: "中国部 G10C1",
    bio: "声音极具穿透力与爆发感，舞台中央闪耀的绝对核心",
    photo: "https://images.unsplash.com/flagged/photo-1561440064-26f554ab03a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGluZXNlJTIwZmVtYWxlJTIwc2luZ2VyJTIwc3RhZ2V8ZW58MXx8fHwxNzgwMzE0MzcyfDA&ixlib=rb-4.1.0&q=80&w=1080",
  }
];

export function MembersSection() {
  return (
    <section
      id="members"
      className="py-24 px-6"
      style={{ background: "#0A0A12" }}
    >
      <div className="max-w-7xl mx-auto">
        <SectionHeader label="乐队成员" title="THE BAND" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MemberCard({ member }: { member: (typeof members)[number] }) {
  const isLeader = "isLeader" in member && member.isLeader;
  
  return (
    <div 
      className="group relative overflow-hidden transition-all duration-300" 
      style={{ 
        background: "#0E0E1C", 
        border: isLeader ? "1px solid #FF9FD4" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isLeader ? "0 0 20px rgba(255,159,212,0.15)" : "none",
        zIndex: isLeader ? 10 : 1
      }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
        <ImageWithFallback
          src={member.photo}
          alt={member.name}
          className="relative w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background:
              "linear-gradient(to top, rgba(7,7,12,0.95) 0%, rgba(7,7,12,0.3) 50%, transparent 100%)",
          }}
        />
        
        {isLeader && (
          <div className="absolute top-4 right-4 text-2xl drop-shadow-md animate-bounce" style={{ animationDuration: "2s" }}>
            👑
          </div>
        )}
        
        <div
          className="absolute bottom-0 left-0 right-0 p-5"
        >
          <div
            className="text-xs uppercase tracking-[0.25em] mb-1.5 px-2 py-0.5 inline-block"
            style={{
              background: "#FF9FD4",
              color: "#07070C",
              fontFamily: "'Anton', sans-serif",
              letterSpacing: "0.2em",
              fontSize: "0.65rem",
            }}
          >
            {member.role}
          </div>
          <h3
            className="text-foreground leading-tight flex items-center gap-2"
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: "1.5rem",
              letterSpacing: "0.05em",
              color: isLeader ? "#FF9FD4" : "white"
            }}
          >
            {member.name}
          </h3>
          <p
            className="text-muted-foreground text-xs mt-0.5 uppercase tracking-widest"
            style={{ opacity: 0.6 }}
          >
            {member.nameEn} {member.roleEn ? `· ${member.roleEn}` : ''}
          </p>
        </div>
      </div>

      <div
        className="px-5 py-4 transition-all duration-300 group-hover:opacity-100 opacity-80"
        style={{ borderTop: isLeader ? "1px solid rgba(255,159,212,0.2)" : "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-muted-foreground text-sm leading-relaxed">{member.bio}</p>
      </div>
    </div>
  );
}
