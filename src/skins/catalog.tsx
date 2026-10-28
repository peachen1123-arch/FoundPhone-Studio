import { lazy, type ComponentType } from "react";
import type { SkinProps } from "../AppSkins";
// 慢网环境（GitHub Pages 国内 ~13KB/s）下，懒加载分包会让每个 App 打开时
// 卡在「正在打开…」甚至超时只剩文字。因此把所有 skin 直接静态导入打进主包。
import * as system from "./SystemSkins";
import * as messaging from "./MessagingSkins";
import * as social from "./SocialSkins";
import * as media from "./MediaSkins";
import * as commerce from "./CommerceSkins";
import * as mymy from "../vendor/mymy/Apps";
import * as threads from "./ThreadsReference";
function skin<T extends Record<string, unknown>>(mod: T, name: keyof T) {
  return lazy(async () => ({
    default: mod[name] as ComponentType<SkinProps>,
  }));
}
export const catalogSkins = {
  kakao: skin(mymy, "MymyKakao"),
  instagram: skin(mymy, "MymyInstagram"),
  phone: skin(system, "PhoneSkin"),
  contacts: skin(system, "ContactsSkin"),
  photos: skin(system, "PhotosSkin"),
  camera: skin(system, "CameraSkin"),
  safari: skin(system, "SafariSkin"),
  notes: skin(system, "NotesSkin"),
  calendar: skin(system, "CalendarSkin"),
  mail: skin(system, "MailSkin"),
  clock: skin(system, "ClockSkin"),
  reminders: skin(system, "RemindersSkin"),
  files: skin(system, "FilesSkin"),
  music: skin(system, "MusicSkin"),
  maps: skin(system, "MapsSkin"),
  weather: skin(system, "WeatherSkin"),
  wallet: skin(system, "WalletSkin"),
  health: skin(system, "HealthSkin"),
  find: skin(system, "FindSkin"),
  messages: skin(messaging, "MessagesSkin"),
  qq: skin(messaging, "QQSkin"),
  telegram: skin(messaging, "TelegramSkin"),
  discord: skin(messaging, "DiscordSkin"),
  line: skin(messaging, "LineSkin"),
  messenger: skin(messaging, "MessengerSkin"),
  weibo: skin(social, "WeiboSkin"),
  twitter: skin(mymy, "MymyX"),
  threads: skin(threads, "ThreadsReference"),
  facebook: skin(social, "FacebookSkin"),
  redbook: skin(social, "RedbookSkin"),
  pinterest: skin(social, "PinterestSkin"),
  reddit: skin(social, "RedditSkin"),
  forum: skin(social, "ForumSkin"),
  snapchat: skin(social, "SnapchatSkin"),
  spotify: skin(media, "SpotifySkin"),
  netease: skin(media, "NeteaseSkin"),
  youtube: skin(media, "YouTubeSkin"),
  bilibili: skin(media, "BilibiliSkin"),
  douyin: skin(media, "DouyinSkin"),
  tiktok: skin(media, "TikTokSkin"),
  netflix: skin(media, "NetflixSkin"),
  alipay: skin(commerce, "AlipaySkin"),
  taobao: skin(commerce, "TaobaoSkin"),
  delivery: skin(commerce, "DeliverySkin"),
};
