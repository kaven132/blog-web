# -*- coding: utf-8 -*-
"""
临时脚本：给旅游类文章随机添加演示评论（写入 data/blog.db）。

用法：
    python scripts/_seed-comments.py            # 执行（会先打印将要写入的内容）
    python scripts/_seed-comments.py --dry-run  # 只看不写
    python scripts/_seed-comments.py --clear    # 按清单删除本脚本此前插入的评论

注意：写入唯一数据源 data/blog.db，运行前请先备份。
"""
import json
import os
import sqlite3
import random
import sys
import datetime

DB = "data/blog.db"
MANIFEST = "scripts/_demo-comments.json"  # 记录本脚本插入的评论 id，便于回滚
SEED = 20260918  # 固定随机种子，便于复现

rng = random.Random(SEED)

# ── 针对具体城市的评论（最近 8 篇旅游文）────────────────────────────────
TAILORED = {
    "travel-tengchong-20260918": [
        ("云在旅途", "和顺古镇那个洗衣亭早上七点几乎没人，光斜斜打在水面上，比下午好看太多。热海那边记得别穿浅色鞋，硫磺水溅上去洗不掉的。"),
        ("背包客小陈", "大救驾就是炒饵块吧？第一次在腾冲吃还以为是普通炒面，结果那个嚼劲完全不一样，配一碗稀豆粉绝了。"),
        ("老张的相机", "银杏村要掐准时间，我们十一月中旬去正好是最好的一周，再晚叶子就掉光了。火山公园那个坑爬上来是真喘。"),
        ("半糖去冰", "温泉泡完身上那股硫磺味能留一整天，回酒店洗了两次都觉得还在，有点上瘾。"),
    ],
    "travel-almaty-20260917": [
        ("山与海", "琼布拉克的缆车冬天和夏天完全是两个季节，夏天上去还得穿外套，山下三十多度山上十几度，温差把人整不会了。"),
        ("一只柠檬", "马肉汤第一次喝有点心理障碍，喝下去发现就是很浓的汤底味道，配着面片其实挺香。"),
        ("阿汤哥", "苹果之城这个说法是真的，市场里苹果品种多到数不清，还有那种特别小的野生苹果，酸得眉毛都皱起来。"),
        ("路上的猫", "大阿拉木图湖要早点去，中午之后车能排到山脚。水是那种冰川绿，站岸边都不敢大声说话。"),
    ],
    "travel-qiandongnan-20260916": [
        ("慢生活研究所", "酸汤鱼跟贵州其他地方的做法还是有区别，凯里那边的红酸汤更浓，配糯米饭能吃两碗。"),
        ("干饭第一名", "糯米饭捏成团太形象了，村里阿姨直接用手一攥就递过来，第一次还不太敢接，后来发现这是最方便的吃法。"),
        ("三分钟热度", "侗族大歌是真的震撼，不是表演那种感觉，就是一群人坐在鼓楼底下自然就唱起来了，音一叠上去鸡皮疙瘩都起来了。"),
        ("洱海边的风", "一个山头换一种话这个太真实了，包车师傅说隔一座山他就听不太懂，普通话反而是通用语言。"),
    ],
    "travel-tirana-20260915": [
        ("云在旅途", "那些橘色和湖蓝的楼是有意刷的，据说是城市色彩计划，站在斯坎德培广场四望真的像打翻了调色盘。"),
        ("半糖去冰", "地堡改成博物馆和音乐厅这个操作太妙了，进去的时候又压抑又新鲜，声学效果意外地好。"),
        ("阿May", "中午一点才是正餐这点深有体会，我们十一点饿了找不到开门的店，最后只能在路边喝咖啡。"),
        ("老张的相机", "咖啡便宜到离谱，街边一杯不到十块钱，本地人一杯能坐一个下午，那种松弛感学不来。"),
    ],
    "travel-quanzhou-20260914": [
        ("一只柠檬", "面线糊配油条是早餐标配吧，加了醋肉和大肠，一碗下去整个人都热起来。西街那边早上六点就有得吃。"),
        ("慢生活研究所", "一炷香工夫路过三种宗教场所这个描述太准了，关岳庙香火旺得吓人，旁边清净寺又是另一套气场。"),
        ("三分钟热度", "蟳埔村的簪花围现在太多人排队，建议早点去，不然光等造型就要一小时。阿姨们盘头发的手法是真快。"),
        ("山与海", "开元寺那两座塔在夕阳下最好看，石头颜色会变。寺里那棵千年古桑树别错过。"),
    ],
    "travel-kathmandu-20260913": [
        ("背包客小陈", "空气确实一般，但杜巴广场的木雕真的值得慢慢看，那些窗棂上一个个人物都是分开雕的。"),
        ("干饭第一名", "momo 就是当地饺子，水煮和油煎都好吃，配的那个辣酱才是灵魂，看着红其实不算太辣。"),
        ("阿汤哥", "雪山真的要等雾散，我们在博达哈那边守了两个早上才看到一次雪山露头，值了。"),
        ("路上的猫", "泰米尔区的巷子容易迷路，地图也不太准，跟着人力车夫走反而更快。"),
    ],
    "travel-luoyang-20260911": [
        ("半糖去冰", "牛肉汤一定要早上六点去，八点以后汤就淡了。当地人都是汤配饼丝，我们第一次不知道还点了两碗汤。"),
        ("老张的相机", "卢舍那大佛隔着伊河看才是最好的角度，下午四点以后光线斜过来，那抹笑是真的会动。"),
        ("一只柠檬", "龙门石窟走下来腿会废，电瓶车钱别省。西山这边洞窟密，东山反而清净。"),
        ("三分钟热度", "牡丹花期太短了，四月中旬那一周最好，晚一周就只剩残花。王城公园人多到走不动。"),
    ],
    "travel-cape-town-20260910": [
        ("山与海", "桌山那个「桌布」云不是天天有，我们去的时候是晴天，朋友晚一周去就整个被云盖住了，运气成分太大。"),
        ("洱海边的风", "波卡普那条街颜色是真的艳，但拍照要趁上午，下午整条街都在阴影里。"),
        ("阿May", "好望角的风能把人吹跑，那个牌子前面排队要等很久，其实站远一点反而拍得更好看。"),
        ("背包客小陈", "企鹅滩的企鹅就在栈道旁边，离得特别近但千万别跨栏，工作人员会吹哨。海水冷得脚趾发麻。"),
    ],
}

# ── 通用评论池（随机撒给其他旅游文）─────────────────────────────────────
GENERIC = [
    ("云在旅途", "收藏了，这条线正好在下个月的行程里，等我去完回来汇报。"),
    ("一只柠檬", "看完就饿了，你写的吃的那几段是我最爱看的，比攻略实在。"),
    ("半糖去冰", "请问那边几月份去最合适？我看照片里的天气好像不算太热。"),
    ("老张的相机", "照片的色调真好看，是有后期还是机身直出？想去拍一组。"),
    ("慢生活研究所", "「把日子过慢半拍」这个说法太对了，出去玩最怕赶行程。"),
    ("路上的猫", "住了几天？我计划四天三晚，感觉有点赶又怕太闲。"),
    ("山与海", "这地方我去年去过一次，看你写的又想再去了，细节抓得真准。"),
    ("阿汤哥", "交通方便吗？不自驾的话靠公共交通能不能转下来。"),
    ("三分钟热度", "你提到的那家店我记下了，希望还没被网红化。"),
    ("干饭第一名", "通篇看下来最馋那段吃的，下次能不能单独出一篇吃的。"),
    ("阿May", "写得真好，读完像自己去了一趟，画面感很强。"),
    ("背包客小陈", "淡季去是不是体验更好？人多的时候这些地方会不会挤爆。"),
]

NAMES = [n for n, _ in GENERIC]  # 供随机选名

NOW = datetime.datetime.now()


def fake_time(base_str):
    """在「文章发布后 2~8 小时」到「当前时间前 1~20 小时」之间随机取一个时刻，
    保证评论一定晚于文章、且不会落到未来。"""
    base = datetime.datetime.strptime(base_str[:19], "%Y-%m-%d %H:%M:%S")
    lo = base + datetime.timedelta(hours=rng.randint(2, 8))
    hi = NOW - datetime.timedelta(hours=rng.randint(1, 20))
    if hi <= lo:  # 文章刚发布不久
        hi = lo + datetime.timedelta(hours=rng.randint(1, 5))
    span = (hi - lo).total_seconds()
    t = lo + datetime.timedelta(seconds=rng.random() * span)
    return t.strftime("%Y-%m-%d %H:%M:%S")


def main():
    if "--clear" in sys.argv:
        if not os.path.exists(MANIFEST):
            print("找不到清单 %s，无法回滚" % MANIFEST)
            return
        ids = json.load(open(MANIFEST, encoding="utf-8"))["ids"]
        conn = sqlite3.connect(DB)
        before = conn.execute("select count(*) from comments").fetchone()[0]
        conn.execute(
            "delete from comments where id in (%s)" % ",".join("?" * len(ids)), ids)
        conn.commit()
        after = conn.execute("select count(*) from comments").fetchone()[0]
        print("已删除 %d 条演示评论：comments %d -> %d" % (before - after, before, after))
        conn.close()
        os.remove(MANIFEST)
        print("清单已移除")
        return

    dry = "--dry-run" in sys.argv
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    travel = list(conn.execute(
        "select id, slug, title, created_at from posts "
        "where tags like '%旅游%' order by id"
    ))

    plan = []  # (post_id, slug, author, content, created_at)

    # 1) 最近 8 篇用定制评论（随机取 3~4 条）
    for p in travel:
        if p["slug"] in TAILORED:
            items = list(TAILORED[p["slug"]])
            rng.shuffle(items)
            keep = rng.randint(3, len(items))
            for author, content in items[:keep]:
                plan.append((p["id"], p["slug"], author, content,
                             fake_time(p["created_at"])))

    # 2) 另外随机挑 4 篇没被覆盖的旅游文，从通用池里取「不重复」的若干条
    rest = [p for p in travel if p["slug"] not in TAILORED]
    rng.shuffle(rest)
    generic_pool = list(GENERIC)
    rng.shuffle(generic_pool)
    for p in rest[:4]:
        for _ in range(rng.randint(1, 3)):
            if not generic_pool:
                break
            author, content = generic_pool.pop()
            plan.append((p["id"], p["slug"], author, content,
                         fake_time(p["created_at"])))

    plan.sort(key=lambda x: (x[0], x[4]))
    ids = {x[0] for x in plan}
    print("=== 播种计划（%d 条，覆盖 %d 篇）===" % (len(plan), len(ids)))
    for post_id, slug, author, content, ts in plan:
        print("  [%s] %-28s %s | %s" % (post_id, slug, ts, author))
        print("        %s" % content[:56])

    future = [x for x in plan if x[4] > NOW.strftime("%Y-%m-%d %H:%M:%S")]
    print("\n未来时间戳条数 = %d（应为 0）" % len(future))

    if dry:
        print("(dry-run，未写入)")
        conn.close()
        return

    cur = conn.cursor()
    cur.executemany(
        "insert into comments (post_id, author, content, created_at) values (?,?,?,?)",
        [(pid, a, c, t) for pid, _, a, c, t in plan],
    )
    conn.commit()
    ids = [r[0] for r in conn.execute(
        "select id from comments order by id desc limit ?", (len(plan),))]
    json.dump({"created_at": NOW.strftime("%Y-%m-%d %H:%M:%S"), "ids": sorted(ids)},
              open(MANIFEST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("已写入 %d 条（清单 -> %s）；comments 总数 = %d" % (
        len(plan), MANIFEST,
        conn.execute("select count(*) from comments").fetchone()[0]))
    conn.close()


if __name__ == "__main__":
    main()
