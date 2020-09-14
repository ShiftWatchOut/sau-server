import Koa from "koa";
import Cheerio from "cheerio";
import Superagent from "superagent";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";
import Static from "koa-static";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Send from "koa-send";
import fs, { promises as fsPromises } from "fs";

// 在 ES Module 下 dirname 变量的引入
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
/**
 * 转换状态到颜色
 */
const parseStatus = (str) => {
  switch (str) {
    case '通过':
      str = 'green'
      break;
    case '未通过':
      str = 'gray'
      break;
    case '驳回':
      str = 'red'
      break;
    default:
      str = 'gray'
      break;
  }
  return str;
}

router
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
  .get('/newsContent', async (ctx, next) => {
    const items = [];
    await Superagent.get(BASE_URL + "/chronicle/newsDetail").query({
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
  // 社团状态 前端传入 clubname status
  .post('/searchStatue', async (ctx, next) => {
    const param = filterEmpty(ctx.request.body);
    const items = [];
    await Superagent.post(BASE_URL + "/clubmodify/_OrdinaryClubList").query(param).then((res) => {
      let $ = Cheerio.load(res.text);
      $('a[style="text-decoration:underline"]').each(function (idx, ele) {
        let _el = $(ele);
        let $el = _el.parent().parent().text().replace(/\s+/g, ',').split(',');
        let rever = _el.parent().parent().children();
        items.push({
          name: $el[1],
          type: 'ordinary',
          link: _el.attr('href').replace(/\S+clubid=/, ''),
          // promoter: $el[2],
          // teacher: $el[3],
          // time: $el[4],
          colStat: rever.eq(-2).text().replace(/\s+/g, ''),//parseStatus(),
          sauStat: rever.eq(-1).text().replace(/\s+/g, ''),//parseStatus()
        })
      })
    })
    await Superagent.post(BASE_URL + '/clubmodify/_studyclublist').query(param).then((sres) => {
      let $ = Cheerio.load(sres.text);
      $('a[style="text-decoration:underline"]').each(function (idx, ele) {
        let _el = $(ele);
        let $el = _el.parent().parent().text().replace(/\s+/g, ',').split(',');
        let rever = _el.parent().parent().children();
        items.push({
          name: $el[1],
          type: 'study',
          link: _el.attr('href').replace(/\S+clubid=/, ''),
          // promoter: $el[2],
          // time: $el[3],
          colStat: rever.eq(-2).text().replace(/\s+/g, ''),//parseStatus(),
          sauStat: rever.eq(-1).text().replace(/\s+/g, ''),//parseStatus()
        })
      })
    })
    ctx.body = items;
  })
  // 社团详情 传入 club_id type(0|1)
  .get('/clubDetail', async (ctx, next) => {
    const { clubid, type } = ctx.query;
    // 一度怀疑这里不必区分类型，只传 clubid 就能查到
    const diverLinks = [
      '/clubmodify/studyClubDetail', // 0 是学术
      '/clubmodify/OrdinaryClubDetail', // 1 是非学术
    ]
    const txt = [];
    await Superagent.get(BASE_URL + diverLinks[type]).query({ clubid }).then((res) => {
      let $ = Cheerio.load(res.text);
      let _el = $('table.formtable td');
      let _el2 = $('table.formtable th');
      let dLL = _el.children('a').attr('href');
      //解析方式一致
      _el.each(function (idx, ele) {
        txt.push({
          name: '',
          content: $(ele).text().replace(/\s+/g, '')
        })
      })
      _el2.each(function (idx, ele) {
        txt[idx].name = $(ele).text().replace(/\s+/g, '')
      })
      ctx.body = {
        text: txt,
        link: dLL
      }
    })
  })
  // 反馈至文件 前端传入 data
  .post("/feedback", async (ctx, next) => {
    const data = Buffer.from("\n" + ctx.request.body.data);
    let message = "";
    try {
      await fsPromises.appendFile("./file/feed.txt", data, "utf-8");
      message = "File Write OK";
    } catch (error) {
      message = "Internall server error";
    } finally {
      ctx.body = {
        message,
      };
    }
  })
  // 资料文件下载 前端 get 请求 /file/date/file 路径
  .get('/file/:date/:file', async (ctx, next) => {
    const date = ctx.params.date;
    const file = ctx.params.file;
    const netFile = "/file/" + date + '/' + file;; // 在读取本地文件时要加上 '.' 访问网络文件时要去掉
    const filePath = '.' + netFile;
    const dirPath = filePath.slice(0, 18);
    console.log('filePath: ', filePath);
    console.log('dirPath: ', dirPath);
    await fsPromises.access(dirPath, fs.constants.R_OK | fs.constants.W_OK).catch((err) => {
      if (err.code = 'ENOENT') {
        console.log('dir made');
        fsPromises.mkdir(dirPath, { recursive: true });
      }
    })
    await fsPromises.access(filePath, fs.constants.R_OK)
      .then(async () => {
        console.log('file exists');
        // console.log('before send 111');
        // await Send(ctx, filePath);
        // console.log('after send 111');
      })
      .catch(async (readerr) => {
        console.log("readerr");
        await Superagent
          .get(BASE_URL + "/upload" + netFile)
          .then(async (sres) => {
            console.log('try to write');
            fs.writeFileSync(filePath, sres.body, 'binary');
            // console.log('before send 222');
            // await Send(ctx, filePath);
            // console.log('after send 222');
          });
      })
      .finally(async () => {
        console.log('before send 333');
        await Send(ctx, filePath);
        console.log('after send 333');
      });
  });

app
  .use(Static(join(__dirname)))
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
