/**
 * 像素图标资源表。
 *
 * 主题原先用 Iconify 矢量图标(tabler/mdi/lucide/icon-park),细线风格和本主题的像素拟物感不搭。
 * 这里换成 AI 生成的像素 sprite(1px 深棕描边 + 受限调色板);同时保留 iconify 名 → 像素图 key 的映射,
 * 找不到像素图时 PixelIcon 自动回落到矢量图标,不会空白。
 *
 * 局部变量统一加 icon_ 前缀:switch / default 这类是 JS 保留字,直接当标识符会解析失败。
 */
import icon_application from '@/assets/pixel-icons/application.png'
import icon_arrow_left from '@/assets/pixel-icons/arrow-left.png'
import icon_browser from '@/assets/pixel-icons/browser.png'
import icon_building from '@/assets/pixel-icons/building.png'
import icon_calendar_dollar from '@/assets/pixel-icons/calendar-dollar.png'
import icon_calendar from '@/assets/pixel-icons/calendar.png'
import icon_cash from '@/assets/pixel-icons/cash.png'
import icon_check_circle from '@/assets/pixel-icons/check-circle.png'
import icon_chevron_down from '@/assets/pixel-icons/chevron-down.png'
import icon_chevron_up from '@/assets/pixel-icons/chevron-up.png'
import icon_clock from '@/assets/pixel-icons/clock.png'
import icon_close_x from '@/assets/pixel-icons/close-x.png'
import icon_code from '@/assets/pixel-icons/code.png'
import icon_coin from '@/assets/pixel-icons/coin.png'
import icon_coins from '@/assets/pixel-icons/coins.png'
import icon_computer from '@/assets/pixel-icons/computer.png'
import icon_cpu from '@/assets/pixel-icons/cpu.png'
import icon_dashboard from '@/assets/pixel-icons/dashboard.png'
import icon_desktop from '@/assets/pixel-icons/desktop.png'
import icon_error from '@/assets/pixel-icons/error.png'
import icon_globe from '@/assets/pixel-icons/globe.png'
import icon_hard_disk from '@/assets/pixel-icons/hard-disk.png'
import icon_hourglass from '@/assets/pixel-icons/hourglass.png'
import icon_info from '@/assets/pixel-icons/info.png'
import icon_memory from '@/assets/pixel-icons/memory.png'
import icon_receipt from '@/assets/pixel-icons/receipt.png'
import icon_server from '@/assets/pixel-icons/server.png'
import icon_setting from '@/assets/pixel-icons/setting.png'
import icon_shield from '@/assets/pixel-icons/shield.png'
import icon_socket from '@/assets/pixel-icons/socket.png'
import icon_spinner from '@/assets/pixel-icons/spinner.png'
import icon_sun from '@/assets/pixel-icons/sun.png'
import icon_switch from '@/assets/pixel-icons/switch.png'
import icon_time from '@/assets/pixel-icons/time.png'
import icon_timer from '@/assets/pixel-icons/timer.png'
import icon_transfer from '@/assets/pixel-icons/transfer.png'
import icon_tulip from '@/assets/pixel-icons/tulip.png'
import icon_video from '@/assets/pixel-icons/video.png'
import icon_wallet from '@/assets/pixel-icons/wallet.png'
import icon_warning from '@/assets/pixel-icons/warning.png'
import icon_world_pin from '@/assets/pixel-icons/world-pin.png'

import icon_traffic_down from '@/assets/pixel-icons/traffic-down.png'
import icon_traffic_total from '@/assets/pixel-icons/traffic-total.png'
import icon_traffic_up from '@/assets/pixel-icons/traffic-up.png'

export const PIXEL_ICONS: Record<string, string> = {
  'application': icon_application,
  'arrow-left': icon_arrow_left,
  'browser': icon_browser,
  'building': icon_building,
  'calendar': icon_calendar,
  'calendar-dollar': icon_calendar_dollar,
  'cash': icon_cash,
  'check-circle': icon_check_circle,
  'chevron-down': icon_chevron_down,
  'chevron-up': icon_chevron_up,
  'clock': icon_clock,
  'close-x': icon_close_x,
  'code': icon_code,
  'coin': icon_coin,
  'coins': icon_coins,
  'computer': icon_computer,
  'cpu': icon_cpu,
  'dashboard': icon_dashboard,
  'desktop': icon_desktop,
  'error': icon_error,
  'globe': icon_globe,
  'hard-disk': icon_hard_disk,
  'hourglass': icon_hourglass,
  'info': icon_info,
  'memory': icon_memory,
  'receipt': icon_receipt,
  'server': icon_server,
  'setting': icon_setting,
  'shield': icon_shield,
  'socket': icon_socket,
  'spinner': icon_spinner,
  'sun': icon_sun,
  'switch': icon_switch,
  'time': icon_time,
  'timer': icon_timer,
  'transfer': icon_transfer,
  'traffic-down': icon_traffic_down,
  'traffic-total': icon_traffic_total,
  'traffic-up': icon_traffic_up,
  'tulip': icon_tulip,
  'video': icon_video,
  'wallet': icon_wallet,
  'warning': icon_warning,
  'world-pin': icon_world_pin,
}

/** Iconify 图标名 → 像素图 key(没有对应像素图的保持原样,调用方会回落矢量图标)。 */
export const ICONIFY_TO_PIXEL: Record<string, string> = {
  'carbon:information': 'info',
  'icon-park-outline:application-two': 'application',
  'icon-park-outline:code': 'code',
  'icon-park-outline:computer': 'computer',
  'icon-park-outline:cpu': 'cpu',
  'icon-park-outline:dashboard-one': 'dashboard',
  'icon-park-outline:hard-disk': 'hard-disk',
  'icon-park-outline:memory': 'memory',
  'icon-park-outline:server': 'server',
  'icon-park-outline:setting': 'setting',
  'icon-park-outline:sun': 'sun',
  'icon-park-outline:switch': 'switch',
  'icon-park-outline:time': 'time',
  'icon-park-outline:timer': 'timer',
  'icon-park-outline:transfer-data': 'transfer',
  'icon-park-outline:video-one': 'video',
  'lucide:circle-check': 'check-circle',
  'lucide:info': 'info',
  'lucide:loader-2': 'spinner',
  'lucide:octagon-x': 'error',
  'lucide:triangle-alert': 'warning',
  'lucide:x': 'close-x',
  'mdi:calendar': 'calendar',
  'mdi:clock-outline': 'clock',
  'mdi:earth': 'globe',
  'mdi:flower-tulip': 'tulip',
  'mdi:shield-check': 'shield',
  'mdi:timer-sand': 'hourglass',
  'tabler:arrow-left': 'arrow-left',
  'tabler:brand-socket-io': 'socket',
  'tabler:browser': 'browser',
  'tabler:building-skyscraper': 'building',
  'tabler:calendar-dollar': 'calendar-dollar',
  'tabler:cash': 'cash',
  'tabler:chevron-down': 'chevron-down',
  'tabler:chevron-up': 'chevron-up',
  'tabler:clock-hour-4': 'clock',
  'tabler:coin': 'coin',
  'tabler:coins': 'coins',
  'tabler:device-desktop': 'desktop',
  'tabler:receipt-2': 'receipt',
  'tabler:wallet': 'wallet',
  'tabler:world-pin': 'world-pin',
}
