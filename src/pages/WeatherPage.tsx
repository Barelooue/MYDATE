// src/pages/WeatherPage.tsx
import { useState, useEffect } from 'react';

interface HourlyForecast {
  time: string;
  temp: number;
  icon: string;
  rainProb: number; // 降水概率
}

interface WeatherData {
  city: string;
  currentTemp: number;
  condition: string;
  high: number;
  low: number;
  humidity: string;
  uvIndex: string;
  hourly: HourlyForecast[];
  rainNotice: string;
}

export function WeatherPage() {
  const [loading, setLoading] = useState(true);
  const [weather, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    // 1. 自动获取地理位置
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`[GPS 定位成功] 纬度:${latitude}, 经度:${longitude}`);
        
        // 2. 模拟商业级实时分时天气 API 请求 (如和风天气/高德天气接口)
        setTimeout(() => {
          setWeatherData({
            city: "上海市 浦东新区", // 实际会通过逆地理编码获取
            currentTemp: 18,
            condition: "多云转小雨",
            high: 22,
            low: 14,
            humidity: "78%",
            uvIndex: "弱 (适合素颜出行)",
            rainNotice: "预计下午 14:00 左右开始下雨，出门记得带伞哦 🌧️",
            hourly: [
              { time: "08:00", temp: 15, icon: "🌤️", rainProb: 10 },
              { time: "10:00", temp: 18, icon: "☁️", rainProb: 20 },
              { time: "12:00", temp: 21, icon: "☁️", rainProb: 40 },
              { time: "14:00", temp: 20, icon: "🌧️", rainProb: 85 },
              { time: "16:00", temp: 19, icon: "🌧️", rainProb: 90 },
              { time: "18:00", temp: 17, icon: "🌤️", rainProb: 30 },
            ]
          });
          setLoading(false);
        }, 1000);
      },
      (error) => {
        console.error("GPS 定位失败，走默认城市兜底", error);
        // 拒绝定位时的安全兜底数据
        setWeatherData({
          city: "北京市 朝阳区 (默认)",
          currentTemp: 20,
          condition: "晴朗",
          high: 25,
          low: 12,
          humidity: "45%",
          uvIndex: "强",
          rainNotice: "今日全天无雨，紫外线较强，注意防晒 ☀️",
          hourly: [
            { time: "08:00", temp: 14, icon: "☀️", rainProb: 0 },
            { time: "12:00", temp: 24, icon: "☀️", rainProb: 0 },
            { time: "18:00", temp: 19, icon: "🌙", rainProb: 0 },
          ]
        });
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin mr-2">⏳</div> 正在精准定位并同步气象雷达数据...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-white bg-gradient-to-b from-sky-900 to-slate-950 rounded-2xl shadow-xl">
      {/* 头部当前天气 */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold flex items-center justify-center gap-2">
          📍 {weather?.city}
        </h2>
        <div className="text-6xl font-extrabold my-4">{weather?.currentTemp}°C</div>
        <p className="text-lg text-sky-300 font-medium">{weather?.condition}</p>
        <p className="text-sm text-slate-400">最高: {weather?.high}°C  最低: {weather?.low}°C</p>
      </div>

      {/* 降雨气象预警 */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-3">
        <span className="text-xl">💡</span>
        <p className="text-sm text-blue-200">{weather?.rainNotice}</p>
      </div>

      {/* 24小时分时预报纵向/横向滚动条 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400">⏱️ 24小时分时趋势</h3>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {weather?.hourly.map((h, idx) => (
            <div key={idx} className="flex-shrink-0 w-20 p-3 bg-white/5 rounded-xl text-center space-y-2 border border-white/5">
              <span className="text-xs text-slate-400 block">{h.time}</span>
              <span className="text-2xl block">{h.icon}</span>
              <span className="text-sm font-semibold block">{h.temp}°C</span>
              <span className="text-[10px] text-blue-400 block">💧{h.rainProb}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 生活指数卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400">空气湿度</div>
          <div className="text-lg font-bold mt-1 text-emerald-400">{weather?.humidity}</div>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400">紫外线指数</div>
          <div className="text-lg font-bold mt-1 text-amber-400">{weather?.uvIndex}</div>
        </div>
      </div>
    </div>
  );
}