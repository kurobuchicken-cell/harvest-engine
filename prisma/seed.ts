import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SourceSeed = {
  companyName: string;
  insuranceType: "life" | "nonlife";
  url: string;
  fetchType: string;
  active: boolean;
  note?: string;
};

const sources: SourceSeed[] = [
  // ── 生保 10社 ──
  {
    companyName: "日本生命",
    insuranceType: "life",
    url: "https://www.nissay.co.jp/kaisha/news/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "第一生命",
    insuranceType: "life",
    url: "https://www.dai-ichi-life.co.jp/company/news/index.html",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "明治安田生命",
    insuranceType: "life",
    url: "https://www.meijiyasuda.co.jp/profile/news/release/index.html",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "住友生命",
    insuranceType: "life",
    url: "https://www.sumitomolife.co.jp/news/newsrelease/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "かんぽ生命",
    insuranceType: "life",
    url: "https://www.jp-life.japanpost.jp/information/press/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "アフラック生命",
    insuranceType: "life",
    url: "https://www.aflac.co.jp/corp/profile/news/",
    fetchType: "html",
    active: false,
    note: "WebFetchで403 Forbidden。bot対策の可能性。将来Puppeteer対応時にactive=1へ",
  },
  {
    companyName: "プルデンシャル生命",
    insuranceType: "life",
    url: "https://www.prudential.co.jp/press/",
    fetchType: "html",
    active: false,
    note: "WebFetchで403 Forbidden。bot対策の可能性。将来Puppeteer対応時にactive=1へ",
  },
  {
    companyName: "マニュライフ生命",
    insuranceType: "life",
    url: "https://www.manulife.co.jp/ja/individual/about/newsrelease/press.html",
    fetchType: "html",
    active: false,
    note: "WebFetchで403 Forbidden。bot対策の可能性。将来Puppeteer対応時にactive=1へ",
  },
  {
    companyName: "ソニー生命",
    insuranceType: "life",
    url: "https://www.sonylife.co.jp/company/news/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "ライフネット生命",
    insuranceType: "life",
    url: "https://www.lifenet-seimei.co.jp/newsrelease/",
    fetchType: "html",
    active: true,
  },

  // ── 損保 10社(東京海上日動火災は自社ページ+HD RSSの2レコード) ──
  {
    companyName: "東京海上日動火災",
    insuranceType: "nonlife",
    url: "https://www.tokiomarine-nichido.co.jp/company/release/",
    fetchType: "html",
    active: false,
    note: "自社ページはWebFetchで403 Forbidden。実収集は東京海上HDのRSSソースを使用。将来Puppeteer対応時にactive=1へ",
  },
  {
    companyName: "東京海上日動火災",
    insuranceType: "nonlife",
    url: "https://www.tokiomarinehd.com/feed/release.xml",
    fetchType: "rss",
    active: true,
    note: "自社ページ403の代替として東京海上HDのプレスリリースRSSを登録",
  },
  {
    companyName: "損害保険ジャパン",
    insuranceType: "nonlife",
    url: "https://www.sompo-japan.co.jp/news/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "三井住友海上火災",
    insuranceType: "nonlife",
    url: "https://www.ms-ins.com/news/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "あいおいニッセイ同和損保",
    insuranceType: "nonlife",
    url: "https://www.aioinissaydowa.co.jp/corporate/about/news/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "AIG損保",
    insuranceType: "nonlife",
    url: "https://www.aig.co.jp/sonpo/company/news",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "SBI損保",
    insuranceType: "nonlife",
    url: "https://www.sbisonpo.co.jp/company/news/",
    fetchType: "html",
    active: true,
  },
  {
    companyName: "ソニー損保",
    insuranceType: "nonlife",
    url: "https://from.sonysonpo.co.jp/topics/news/",
    fetchType: "html",
    active: false,
    note: "一覧ページがWebFetchで403 Forbidden。将来Puppeteer対応時にactive=1へ",
  },
  {
    companyName: "東京海上ダイレクト",
    insuranceType: "nonlife",
    url: "https://www.e-design.net/company/information/",
    fetchType: "html",
    active: true,
    note: "2025年10月にイーデザイン損保より社名変更。旧URLは登録せず新ブランド名のみ",
  },
  {
    companyName: "SOMPOダイレクト損害保険",
    insuranceType: "nonlife",
    url: "https://news-ins-saison.dga.jp/topics/",
    fetchType: "html",
    active: true,
    note: "2024年10月にセゾン自動車火災保険より社名変更。旧URLは登録せず新ブランド名のみ",
  },
  {
    companyName: "楽天損保",
    insuranceType: "nonlife",
    url: "https://www.rakuten-sonpo.co.jp/news/",
    fetchType: "html",
    active: true,
  },

  // ── Statuspage対象 15件(SaaS各社のステータスページJSON) ──
  {
    companyName: "Slack",
    insuranceType: "statuspage",
    url: "https://slack-status.com/api/v2.0.0/current",
    fetchType: "json",
    active: true,
    note: "旧/api/v2/summary.jsonは404(現行APIに移行済み)",
  },
  {
    companyName: "Notion",
    insuranceType: "statuspage",
    url: "https://www.notion-status.com/api/v2/summary.json",
    fetchType: "json",
    active: true,
  },
  {
    companyName: "Zoom",
    insuranceType: "statuspage",
    url: "https://status.zoom.us/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "GitHub",
    insuranceType: "statuspage",
    url: "https://www.githubstatus.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Cloudflare",
    insuranceType: "statuspage",
    url: "https://www.cloudflarestatus.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Stripe",
    insuranceType: "statuspage",
    url: "https://status.stripe.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "実体はwww.stripestatus.com(Statuspage.io)。そちらもrobots.txtが/apiをDisallowしているため取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Datadog",
    insuranceType: "statuspage",
    url: "https://status.datadoghq.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Zendesk",
    insuranceType: "statuspage",
    url: "https://status.zendesk.com/api/incidents/active",
    fetchType: "json",
    active: true,
    note: "旧/api/v2/summary.jsonは404。公式Status API(developer.zendesk.com記載)に変更",
  },
  {
    companyName: "HubSpot",
    insuranceType: "statuspage",
    url: "https://status.hubspot.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Twilio",
    insuranceType: "statuspage",
    url: "https://status.twilio.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Asana",
    insuranceType: "statuspage",
    url: "https://status.asana.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Atlassian",
    insuranceType: "statuspage",
    url: "https://status.atlassian.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Dropbox",
    insuranceType: "statuspage",
    url: "https://status.dropbox.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Figma",
    insuranceType: "statuspage",
    url: "https://status.figma.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "Statuspage.io標準robots.txtが/apiをDisallowしているため、/api/v2/summary.jsonを取得不可。robots.txt尊重ポリシーによりinactiveとする",
  },
  {
    companyName: "Salesforce",
    insuranceType: "statuspage",
    url: "https://status.salesforce.com/api/v2/summary.json",
    fetchType: "json",
    active: false,
    note: "summary.jsonへの直接アクセスがサーバー側で拒否される(HTTP 403 'Direct API access not allowed')。robots.txtではなくAPI自体の制約",
  },
];

async function main() {
  await prisma.source.deleteMany();
  await prisma.source.createMany({ data: sources });

  const total = await prisma.source.count();
  const activeCount = await prisma.source.count({ where: { active: true } });
  console.log(`sources投入完了: 全${total}件 / active=${activeCount}件 / inactive=${total - activeCount}件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
