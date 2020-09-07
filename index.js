import Koa from "koa";
import Cheerio from "cheerio";
import Superagent from "superagent";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";
import { promises as fsPromises } from "fs";

const router = new Router();
const app = new Koa();
const port = 3000;
const BASE_URL = "http://sau.scu.edu.cn";

const filterEmpty = (obj) => {
  const tmp = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value) {
        tmp[key] = value;
      }
    }
  }
  return tmp
};

router
// 无意义
  .get("/", (ctx, next) => {
    ctx.body = "KOA running!";
  })
  // 新闻列表 前端传入 page
  .get("/newsList", async (ctx, next) => {
    const items = [];
    await Superagent.get(BASE_URL + '/club/clubnews').query({
      pageid: ctx.query.page,
    }).then((res) => {
      const $ = Cheerio.load(res.text);
      $('td.font_b2 span.font_b1 a').each(function (idx, ele) {
        let $ele = $(ele);
        let dat = $ele.parent().parent().next().text();
        let newsId = $ele.attr('href').replace('/chronicle/newsDetail?newsid=', '')
        items.push({
          title: $ele.text(),
          id: newsId,
          time: dat
        })
      })
      ctx.body = items
    })
  })
  // 新闻内容 前端传入 newsid
  .get('/newsContent',async (ctx,  next) => {
    const items = [];
    await Superagent.get(BASE_URL+"/chronicle/newsDetail").query({
      newsid: ctx.query.newsid,
    }).then((res) => { 
      const $ = Cheerio.load(res.text);
      $('td.font_b1 p').each(function (idx, ele) {
        let $ele = $(ele)
        let txt = $ele.text()
        if (txt == '') {
          if ($ele.find('img').length == 1) {
            //console.log($ele.find('img'))
            items.push({
              tag: 'img',
              text: 'http://sau.scu.edu.cn' + $ele.find('img').attr('src').replace('http://sau.scu.edu.cn', '')
            });
          }
        } else if (txt) {
          items.push({
            tag: 'span',
            text: txt
          });
        }
      })
      ctx.body = items;
     })
  })
  // 活动列表 前端传入 page
  .get("/prelist", async (ctx, next) => {
    const items = [];
    await Superagent.get(BASE_URL + "/eventvideo/eventList")
      .query({
        pageid: ctx.query.page,
      })
      .then((res) => {
        const $ = Cheerio.load(res.text);
        $('td[colspan="2"] tbody').each((idx, ele) => {
          const $ele = $(ele);
          const txt = $ele.text().replace(/\s+/g, ",").split(",");
          items.push({
            event: txt[1],
            time: txt[2].replace("时间地点：", "") + " " + txt[3],
            place: txt[4],
            describe: txt[5].replace("活动简介：", ""),
          });
        });
        ctx.body = items;
      });
  })
  // 搜索社团 前端传入 cn ci 等，这里只相对于转发
  .post("/search", async (ctx, next) => {
    const param = filterEmpty(ctx.request.body);
    await Superagent.post(BASE_URL + "/Club/LClub")
      .query(param).then((res) => {
        ctx.body = res.text
      })
  })
  // 反馈至文件 前端传入 data
  .post("/feedback", async (ctx, next) => {
    const data = Buffer.from("\n" + ctx.request.body.data);
    let message = "";
    try {
      await fsPromises.appendFile("feed.txt", data, "utf-8");
      message = "File Write OK";
    } catch (error) {
      console.log(error);
      message = "Internall server error";
    } finally {
      ctx.body = {
        message,
      };
    }
  });

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
