/**
 * 区域数据配置文件
 * 包含中国、美国、新加坡、印尼、泰国、越南、马来西亚的主要行政区域
 * 
 * 数据结构：国家 -> 省/州 -> 市/区
 * 坐标数据：使用主要城市的中心点坐标
 */

import { LatLngLiteral } from '../types';

/**
 * 区域层级数据结构
 */
export const REGION_HIERARCHY: Record<string, Record<string, string[]>> = {
  // 中国
  "China": {
    "Beijing": ["Dongcheng", "Xicheng", "Chaoyang", "Haidian", "Fengtai", "Shijingshan"],
    "Shanghai": ["Huangpu", "Xuhui", "Changning", "Jing'an", "Putuo", "Hongkou"],
    "Guangdong": ["Guangzhou", "Shenzhen", "Zhuhai", "Foshan", "Dongguan"],
    "Jiangsu": ["Nanjing", "Suzhou", "Wuxi", "Changzhou", "Zhenjiang"],
    "Zhejiang": ["Hangzhou", "Ningbo", "Wenzhou", "Jiaxing", "Huzhou"],
    "Sichuan": ["Chengdu", "Mianyang", "Deyang", "Yibin", "Zigong"],
    "Shandong": ["Jinan", "Qingdao", "Yantai", "Weifang", "Zibo"],
    "Hubei": ["Wuhan", "Xiangyang", "Yichang", "Jingzhou", "Huangshi"],
    "Henan": ["Zhengzhou", "Luoyang", "Xinxiang", "Anyang", "Kaifeng"],
    "Fujian": ["Fuzhou", "Xiamen", "Quanzhou", "Zhangzhou", "Putian"]
  },

  // 美国
  "United States": {
    "California": ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Oakland"],
    "New York": ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island", "Buffalo"],
    "Texas": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso"],
    "Florida": ["Miami", "Tampa", "Orlando", "Jacksonville", "Fort Lauderdale", "St. Petersburg"],
    "Illinois": ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Elgin"],
    "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton"],
    "Ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"],
    "Georgia": ["Atlanta", "Augusta", "Columbus", "Savannah", "Athens", "Sandy Springs"],
    "North Carolina": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville"],
    "Michigan": ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Lansing", "Ann Arbor"]
  },

  // 新加坡
  "Singapore": {
    "Central Region": ["Downtown Core", "Marina Bay", "Orchard", "Newton", "Novena", "Toa Payoh"],
    "North Region": ["Woodlands", "Yishun", "Sembawang", "Ang Mo Kio", "Bishan", "Serangoon"],
    "East Region": ["Tampines", "Pasir Ris", "Bedok", "Changi", "Punggol", "Sengkang"],
    "West Region": ["Jurong", "Clementi", "Bukit Batok", "Bukit Panjang", "Choa Chu Kang", "Boon Lay"],
    "North-East Region": ["Hougang", "Punggol", "Sengkang", "Serangoon", "Ang Mo Kio", "Bishan"]
  },

  // 印度尼西亚
  "Indonesia": {
    "Jakarta": ["Jakarta Selatan", "Jakarta Timur", "Jakarta Barat", "Jakarta Pusat", "Jakarta Utara", "Kepulauan Seribu"],
    "West Java": ["Bandung", "Bogor", "Bekasi", "Depok", "Tangerang", "Cimahi"],
    "East Java": ["Surabaya", "Malang", "Kediri", "Blitar", "Mojokerto", "Pasuruan"],
    "Central Java": ["Semarang", "Surakarta", "Magelang", "Pekalongan", "Tegal", "Salatiga"],
    "Bali": ["Denpasar", "Badung", "Gianyar", "Tabanan", "Klungkung", "Bangli"],
    "Sumatra Utara": ["Medan", "Binjai", "Pematangsiantar", "Tanjungbalai", "Tebing Tinggi", "Deli Serdang"],
    "Sumatra Selatan": ["Palembang", "Prabumulih", "Lubuklinggau", "Pagar Alam", "Banyuasin", "Ogan Komering Ulu"],
    "Sulawesi Selatan": ["Makassar", "Parepare", "Palopo", "Gowa", "Maros", "Pangkajene"]
  },

  // 泰国
  "Thailand": {
    "Bangkok": ["Bang Rak", "Pathum Wan", "Chatuchak", "Sathon", "Khlong Toei", "Watthana"],
    "Chiang Mai": ["Mueang", "Mae Rim", "Hang Dong", "San Kamphaeng", "Doi Saket", "Mae Taeng"],
    "Phuket": ["Mueang Phuket", "Kathu", "Thalang", "Ratsada", "Wichit", "Chalong"],
    "Chonburi": ["Mueang Chonburi", "Pattaya", "Si Racha", "Bang Lamung", "Sattahip", "Ban Bueng"],
    "Nonthaburi": ["Mueang Nonthaburi", "Bang Kruai", "Bang Yai", "Pak Kret", "Sai Noi", "Bang Bua Thong"],
    "Samut Prakan": ["Mueang Samut Prakan", "Bang Bo", "Bang Phli", "Phra Pradaeng", "Phra Samut Chedi", "Bang Sao Thong"],
    "Nakhon Ratchasima": ["Mueang Nakhon Ratchasima", "Pak Chong", "Sikhio", "Dan Khun Thot", "Pak Thong Chai", "Chok Chai"],
    "Songkhla": ["Mueang Songkhla", "Hat Yai", "Sadao", "Na Thawi", "Chana", "Thepha"]
  },

  // 越南
  "Vietnam": {
    "Ho Chi Minh": ["District 1", "District 3", "District 5", "District 7", "Thu Duc", "Binh Thanh"],
    "Hanoi": ["Hoan Kiem", "Tay Ho", "Ba Dinh", "Dong Da", "Hai Ba Trung", "Cau Giay"],
    "Da Nang": ["Hai Chau", "Thanh Khe", "Son Tra", "Ngu Hanh Son", "Lien Chieu", "Cam Le"],
    "Can Tho": ["Ninh Kieu", "O Mon", "Binh Thuy", "Cai Rang", "Thot Not", "Vinh Thanh"],
    "Hai Phong": ["Hong Bang", "Ngo Quyen", "Le Chan", "Hai An", "Kien An", "Do Son"],
    "An Giang": ["Long Xuyen", "Chau Doc", "Tan Chau", "An Phu", "Chau Phu", "Chau Thanh"],
    "Khanh Hoa": ["Nha Trang", "Cam Ranh", "Cam Lam", "Van Ninh", "Dien Khanh", "Khanh Vinh"],
    "Lam Dong": ["Da Lat", "Bao Loc", "Don Duong", "Lac Duong", "Dam Rong", "Lam Ha"]
  },

  // 马来西亚
  "Malaysia": {
    "Selangor": ["Petaling Jaya", "Shah Alam", "Subang Jaya", "Klang", "Ampang", "Kajang"],
    "Kuala Lumpur": ["Bukit Bintang", "KLCC", "Bangsar", "Mont Kiara", "Damansara", "Cheras"],
    "Johor": ["Johor Bahru", "Iskandar Puteri", "Pasir Gudang", "Kulai", "Batu Pahat", "Muar"],
    "Penang": ["George Town", "Butterworth", "Bayan Lepas", "Batu Ferringhi", "Gurney", "Tanjung Bungah"],
    "Sabah": ["Kota Kinabalu", "Sandakan", "Tawau", "Lahad Datu", "Keningau", "Papar"],
    "Sarawak": ["Kuching", "Miri", "Sibu", "Bintulu", "Limbang", "Sarikei"],
    "Perak": ["Ipoh", "Taiping", "Teluk Intan", "Sitiawan", "Kampar", "Batu Gajah"],
    "Melaka": ["Melaka City", "Alor Gajah", "Jasin", "Masjid Tanah", "Pulau Sebang", "Tampin"],
    "Negeri Sembilan": ["Seremban", "Nilai", "Port Dickson", "Rembau", "Tampin", "Jempol"],
    "Pahang": ["Kuantan", "Temerloh", "Bentong", "Raub", "Mentakab", "Jerantut"]
  }
};

/**
 * 区域中心点坐标数据
 * 使用主要城市的中心点坐标
 */
export const REGION_CENTERS: Record<string, Record<string, Record<string, LatLngLiteral>>> = {
  "China": {
    "Beijing": {
      "Dongcheng": { lat: 39.9289, lng: 116.3883 },
      "Xicheng": { lat: 39.9150, lng: 116.3667 },
      "Chaoyang": { lat: 39.9219, lng: 116.4437 },
      "Haidian": { lat: 39.9592, lng: 116.2981 },
      "Fengtai": { lat: 39.8584, lng: 116.2864 },
      "Shijingshan": { lat: 39.9067, lng: 116.2227 }
    },
    "Shanghai": {
      "Huangpu": { lat: 31.2304, lng: 121.4737 },
      "Xuhui": { lat: 31.1889, lng: 121.4375 },
      "Changning": { lat: 31.2208, lng: 121.4244 },
      "Jing'an": { lat: 31.2230, lng: 121.4454 },
      "Putuo": { lat: 31.2492, lng: 121.3925 },
      "Hongkou": { lat: 31.2646, lng: 121.4850 }
    },
    "Guangdong": {
      "Guangzhou": { lat: 23.1291, lng: 113.2644 },
      "Shenzhen": { lat: 22.5431, lng: 114.0579 },
      "Zhuhai": { lat: 22.2707, lng: 113.5767 },
      "Foshan": { lat: 23.0215, lng: 113.1214 },
      "Dongguan": { lat: 23.0205, lng: 113.7518 }
    },
    "Jiangsu": {
      "Nanjing": { lat: 32.0603, lng: 118.7969 },
      "Suzhou": { lat: 31.2989, lng: 120.5853 },
      "Wuxi": { lat: 31.4912, lng: 120.3124 },
      "Changzhou": { lat: 31.8112, lng: 119.9740 },
      "Zhenjiang": { lat: 32.1878, lng: 119.4250 }
    },
    "Zhejiang": {
      "Hangzhou": { lat: 30.2741, lng: 120.1551 },
      "Ningbo": { lat: 29.8683, lng: 121.5440 },
      "Wenzhou": { lat: 28.0000, lng: 120.7000 },
      "Jiaxing": { lat: 30.7522, lng: 120.7500 },
      "Huzhou": { lat: 30.8703, lng: 120.0933 }
    },
    "Sichuan": {
      "Chengdu": { lat: 30.6624, lng: 104.0633 },
      "Mianyang": { lat: 31.4678, lng: 104.6797 },
      "Deyang": { lat: 31.1304, lng: 104.4019 },
      "Yibin": { lat: 28.7519, lng: 104.6431 },
      "Zigong": { lat: 29.3394, lng: 104.7784 }
    },
    "Shandong": {
      "Jinan": { lat: 36.6512, lng: 117.1201 },
      "Qingdao": { lat: 36.0671, lng: 120.3826 },
      "Yantai": { lat: 37.4638, lng: 121.4479 },
      "Weifang": { lat: 36.7069, lng: 119.1617 },
      "Zibo": { lat: 36.8135, lng: 118.0549 }
    },
    "Hubei": {
      "Wuhan": { lat: 30.5928, lng: 114.3055 },
      "Xiangyang": { lat: 32.0088, lng: 112.1227 },
      "Yichang": { lat: 30.6919, lng: 111.2865 },
      "Jingzhou": { lat: 30.3349, lng: 112.2384 },
      "Huangshi": { lat: 30.1990, lng: 115.0385 }
    },
    "Henan": {
      "Zhengzhou": { lat: 34.7466, lng: 113.6254 },
      "Luoyang": { lat: 34.6197, lng: 112.4540 },
      "Xinxiang": { lat: 35.3030, lng: 113.9268 },
      "Anyang": { lat: 36.0965, lng: 114.3938 },
      "Kaifeng": { lat: 34.7971, lng: 114.3074 }
    },
    "Fujian": {
      "Fuzhou": { lat: 26.0745, lng: 119.2965 },
      "Xiamen": { lat: 24.4798, lng: 118.0819 },
      "Quanzhou": { lat: 24.9139, lng: 118.5859 },
      "Zhangzhou": { lat: 24.5133, lng: 117.6618 },
      "Putian": { lat: 25.4541, lng: 119.0078 }
    }
  },

  "United States": {
    "California": {
      "Los Angeles": { lat: 34.0522, lng: -118.2437 },
      "San Francisco": { lat: 37.7749, lng: -122.4194 },
      "San Diego": { lat: 32.7157, lng: -117.1611 },
      "San Jose": { lat: 37.3382, lng: -121.8863 },
      "Sacramento": { lat: 38.5816, lng: -121.4944 },
      "Oakland": { lat: 37.8044, lng: -122.2712 }
    },
    "New York": {
      "Manhattan": { lat: 40.7831, lng: -73.9712 },
      "Brooklyn": { lat: 40.6782, lng: -73.9442 },
      "Queens": { lat: 40.7282, lng: -73.7949 },
      "Bronx": { lat: 40.8448, lng: -73.8648 },
      "Staten Island": { lat: 40.5795, lng: -74.1502 },
      "Buffalo": { lat: 42.8864, lng: -78.8784 }
    },
    "Texas": {
      "Houston": { lat: 29.7604, lng: -95.3698 },
      "Dallas": { lat: 32.7767, lng: -96.7970 },
      "Austin": { lat: 30.2672, lng: -97.7431 },
      "San Antonio": { lat: 29.4241, lng: -98.4936 },
      "Fort Worth": { lat: 32.7555, lng: -97.3308 },
      "El Paso": { lat: 31.7619, lng: -106.4850 }
    },
    "Florida": {
      "Miami": { lat: 25.7617, lng: -80.1918 },
      "Tampa": { lat: 27.9506, lng: -82.4572 },
      "Orlando": { lat: 28.5383, lng: -81.3792 },
      "Jacksonville": { lat: 30.3322, lng: -81.6557 },
      "Fort Lauderdale": { lat: 26.1224, lng: -80.1373 },
      "St. Petersburg": { lat: 27.7676, lng: -82.6403 }
    },
    "Illinois": {
      "Chicago": { lat: 41.8781, lng: -87.6298 },
      "Aurora": { lat: 41.7606, lng: -88.3201 },
      "Naperville": { lat: 41.7508, lng: -88.1535 },
      "Joliet": { lat: 41.5250, lng: -88.0817 },
      "Rockford": { lat: 42.2711, lng: -89.0940 },
      "Elgin": { lat: 42.0354, lng: -88.2826 }
    },
    "Pennsylvania": {
      "Philadelphia": { lat: 39.9526, lng: -75.1652 },
      "Pittsburgh": { lat: 40.4406, lng: -79.9959 },
      "Allentown": { lat: 40.6084, lng: -75.4902 },
      "Erie": { lat: 42.1292, lng: -80.0851 },
      "Reading": { lat: 40.3356, lng: -75.9269 },
      "Scranton": { lat: 41.4090, lng: -75.6624 }
    },
    "Ohio": {
      "Columbus": { lat: 39.9612, lng: -82.9988 },
      "Cleveland": { lat: 41.4993, lng: -81.6944 },
      "Cincinnati": { lat: 39.1031, lng: -84.5120 },
      "Toledo": { lat: 41.6528, lng: -83.5379 },
      "Akron": { lat: 41.0814, lng: -81.5190 },
      "Dayton": { lat: 39.7589, lng: -84.1916 }
    },
    "Georgia": {
      "Atlanta": { lat: 33.7490, lng: -84.3880 },
      "Augusta": { lat: 33.4735, lng: -82.0105 },
      "Columbus": { lat: 32.4610, lng: -84.9877 },
      "Savannah": { lat: 32.0809, lng: -81.0912 },
      "Athens": { lat: 33.9519, lng: -83.3576 },
      "Sandy Springs": { lat: 33.9304, lng: -84.3733 }
    },
    "North Carolina": {
      "Charlotte": { lat: 35.2271, lng: -80.8431 },
      "Raleigh": { lat: 35.7796, lng: -78.6382 },
      "Greensboro": { lat: 36.0726, lng: -79.7920 },
      "Durham": { lat: 35.9940, lng: -78.8986 },
      "Winston-Salem": { lat: 36.0999, lng: -80.2442 },
      "Fayetteville": { lat: 35.0527, lng: -78.8784 }
    },
    "Michigan": {
      "Detroit": { lat: 42.3314, lng: -83.0458 },
      "Grand Rapids": { lat: 42.9634, lng: -85.6681 },
      "Warren": { lat: 42.5145, lng: -83.0147 },
      "Sterling Heights": { lat: 42.5803, lng: -83.0302 },
      "Lansing": { lat: 42.7325, lng: -84.5555 },
      "Ann Arbor": { lat: 42.2808, lng: -83.7430 }
    }
  },

  "Singapore": {
    "Central Region": {
      "Downtown Core": { lat: 1.2897, lng: 103.8501 },
      "Marina Bay": { lat: 1.2833, lng: 103.8608 },
      "Orchard": { lat: 1.3036, lng: 103.8314 },
      "Newton": { lat: 1.3136, lng: 103.8403 },
      "Novena": { lat: 1.3201, lng: 103.8438 },
      "Toa Payoh": { lat: 1.3329, lng: 103.8476 }
    },
    "North Region": {
      "Woodlands": { lat: 1.4360, lng: 103.7860 },
      "Yishun": { lat: 1.4294, lng: 103.8350 },
      "Sembawang": { lat: 1.4490, lng: 103.8200 },
      "Ang Mo Kio": { lat: 1.3691, lng: 103.8454 },
      "Bishan": { lat: 1.3526, lng: 103.8352 },
      "Serangoon": { lat: 1.3541, lng: 103.8728 }
    },
    "East Region": {
      "Tampines": { lat: 1.3456, lng: 103.9446 },
      "Pasir Ris": { lat: 1.3733, lng: 103.9494 },
      "Bedok": { lat: 1.3239, lng: 103.9303 },
      "Changi": { lat: 1.3644, lng: 103.9915 },
      "Punggol": { lat: 1.4056, lng: 103.9023 },
      "Sengkang": { lat: 1.3916, lng: 103.8990 }
    },
    "West Region": {
      "Jurong": { lat: 1.3329, lng: 103.7436 },
      "Clementi": { lat: 1.3152, lng: 103.7648 },
      "Bukit Batok": { lat: 1.3490, lng: 103.7490 },
      "Bukit Panjang": { lat: 1.3776, lng: 103.7630 },
      "Choa Chu Kang": { lat: 1.3851, lng: 103.7444 },
      "Boon Lay": { lat: 1.3386, lng: 103.7058 }
    },
    "North-East Region": {
      "Hougang": { lat: 1.3612, lng: 103.8860 },
      "Punggol": { lat: 1.4056, lng: 103.9023 },
      "Sengkang": { lat: 1.3916, lng: 103.8990 },
      "Serangoon": { lat: 1.3541, lng: 103.8728 },
      "Ang Mo Kio": { lat: 1.3691, lng: 103.8454 },
      "Bishan": { lat: 1.3526, lng: 103.8352 }
    }
  },

  "Indonesia": {
    "Jakarta": {
      "Jakarta Selatan": { lat: -6.2615, lng: 106.8106 },
      "Jakarta Timur": { lat: -6.2297, lng: 106.9004 },
      "Jakarta Barat": { lat: -6.1677, lng: 106.7588 },
      "Jakarta Pusat": { lat: -6.1944, lng: 106.8229 },
      "Jakarta Utara": { lat: -6.1384, lng: 106.8950 },
      "Kepulauan Seribu": { lat: -5.6167, lng: 106.6167 }
    },
    "West Java": {
      "Bandung": { lat: -6.9175, lng: 107.6191 },
      "Bogor": { lat: -6.5944, lng: 106.7892 },
      "Bekasi": { lat: -6.2383, lng: 106.9756 },
      "Depok": { lat: -6.3940, lng: 106.8186 },
      "Tangerang": { lat: -6.1783, lng: 106.6319 },
      "Cimahi": { lat: -6.8841, lng: 107.5413 }
    },
    "East Java": {
      "Surabaya": { lat: -7.2575, lng: 112.7521 },
      "Malang": { lat: -7.9797, lng: 112.6304 },
      "Kediri": { lat: -7.8167, lng: 112.0167 },
      "Blitar": { lat: -8.1000, lng: 112.1667 },
      "Mojokerto": { lat: -7.4667, lng: 112.4333 },
      "Pasuruan": { lat: -7.6500, lng: 112.9000 }
    },
    "Central Java": {
      "Semarang": { lat: -6.9667, lng: 110.4167 },
      "Surakarta": { lat: -7.5667, lng: 110.8167 },
      "Magelang": { lat: -7.4706, lng: 110.2178 },
      "Pekalongan": { lat: -6.8833, lng: 109.6667 },
      "Tegal": { lat: -6.8667, lng: 109.1333 },
      "Salatiga": { lat: -7.3333, lng: 110.5000 }
    },
    "Bali": {
      "Denpasar": { lat: -8.6705, lng: 115.2126 },
      "Badung": { lat: -8.5833, lng: 115.1833 },
      "Gianyar": { lat: -8.5417, lng: 115.3250 },
      "Tabanan": { lat: -8.5333, lng: 115.1333 },
      "Klungkung": { lat: -8.5333, lng: 115.4000 },
      "Bangli": { lat: -8.3000, lng: 115.3500 }
    },
    "Sumatra Utara": {
      "Medan": { lat: 3.5952, lng: 98.6722 },
      "Binjai": { lat: 3.6000, lng: 98.4833 },
      "Pematangsiantar": { lat: 2.9667, lng: 99.0500 },
      "Tanjungbalai": { lat: 2.9667, lng: 99.8000 },
      "Tebing Tinggi": { lat: 3.3167, lng: 99.1500 },
      "Deli Serdang": { lat: 3.5167, lng: 98.7000 }
    },
    "Sumatra Selatan": {
      "Palembang": { lat: -2.9911, lng: 104.7567 },
      "Prabumulih": { lat: -3.4333, lng: 104.2333 },
      "Lubuklinggau": { lat: -3.3000, lng: 102.8667 },
      "Pagar Alam": { lat: -4.0167, lng: 103.2500 },
      "Banyuasin": { lat: -2.7833, lng: 104.8833 },
      "Ogan Komering Ulu": { lat: -4.1333, lng: 104.1667 }
    },
    "Sulawesi Selatan": {
      "Makassar": { lat: -5.1477, lng: 119.4327 },
      "Parepare": { lat: -4.0167, lng: 119.6167 },
      "Palopo": { lat: -3.0000, lng: 120.2000 },
      "Gowa": { lat: -5.3167, lng: 119.7333 },
      "Maros": { lat: -5.0500, lng: 119.5667 },
      "Pangkajene": { lat: -4.8167, lng: 119.5500 }
    }
  },

  "Thailand": {
    "Bangkok": {
      "Bang Rak": { lat: 13.7300, lng: 100.5232 },
      "Pathum Wan": { lat: 13.7367, lng: 100.5351 },
      "Chatuchak": { lat: 13.8288, lng: 100.5514 },
      "Sathon": { lat: 13.7200, lng: 100.5300 },
      "Khlong Toei": { lat: 13.7167, lng: 100.5833 },
      "Watthana": { lat: 13.7333, lng: 100.5667 }
    },
    "Chiang Mai": {
      "Mueang": { lat: 18.7883, lng: 98.9853 },
      "Mae Rim": { lat: 18.9122, lng: 98.9397 },
      "Hang Dong": { lat: 18.6833, lng: 98.9167 },
      "San Kamphaeng": { lat: 18.7500, lng: 99.1333 },
      "Doi Saket": { lat: 18.8833, lng: 99.1167 },
      "Mae Taeng": { lat: 19.1167, lng: 98.9000 }
    },
    "Phuket": {
      "Mueang Phuket": { lat: 7.8804, lng: 98.3923 },
      "Kathu": { lat: 7.9167, lng: 98.3333 },
      "Thalang": { lat: 8.0333, lng: 98.3167 },
      "Ratsada": { lat: 7.8500, lng: 98.4000 },
      "Wichit": { lat: 7.8833, lng: 98.3833 },
      "Chalong": { lat: 7.8333, lng: 98.3333 }
    },
    "Chonburi": {
      "Mueang Chonburi": { lat: 13.3611, lng: 100.9844 },
      "Pattaya": { lat: 12.9236, lng: 100.8825 },
      "Si Racha": { lat: 13.1731, lng: 100.9311 },
      "Bang Lamung": { lat: 12.9167, lng: 100.8833 },
      "Sattahip": { lat: 12.6667, lng: 100.9000 },
      "Ban Bueng": { lat: 13.2833, lng: 101.1167 }
    },
    "Nonthaburi": {
      "Mueang Nonthaburi": { lat: 13.8625, lng: 100.5144 },
      "Bang Kruai": { lat: 13.8167, lng: 100.4000 },
      "Bang Yai": { lat: 13.8500, lng: 100.3667 },
      "Pak Kret": { lat: 13.9167, lng: 100.5000 },
      "Sai Noi": { lat: 14.0167, lng: 100.3167 },
      "Bang Bua Thong": { lat: 13.9167, lng: 100.4167 }
    },
    "Samut Prakan": {
      "Mueang Samut Prakan": { lat: 13.5990, lng: 100.5967 },
      "Bang Bo": { lat: 13.5833, lng: 100.8167 },
      "Bang Phli": { lat: 13.6167, lng: 100.7167 },
      "Phra Pradaeng": { lat: 13.6667, lng: 100.5333 },
      "Phra Samut Chedi": { lat: 13.6000, lng: 100.5500 },
      "Bang Sao Thong": { lat: 13.6500, lng: 100.7833 }
    },
    "Nakhon Ratchasima": {
      "Mueang Nakhon Ratchasima": { lat: 14.9708, lng: 102.1019 },
      "Pak Chong": { lat: 14.7000, lng: 101.4167 },
      "Sikhio": { lat: 14.8833, lng: 101.7167 },
      "Dan Khun Thot": { lat: 15.2167, lng: 101.7667 },
      "Pak Thong Chai": { lat: 14.7167, lng: 102.0167 },
      "Chok Chai": { lat: 14.7333, lng: 102.1667 }
    },
    "Songkhla": {
      "Mueang Songkhla": { lat: 7.1981, lng: 100.5953 },
      "Hat Yai": { lat: 7.0084, lng: 100.4767 },
      "Sadao": { lat: 6.6333, lng: 100.4167 },
      "Na Thawi": { lat: 6.7500, lng: 100.6833 },
      "Chana": { lat: 6.9167, lng: 100.7500 },
      "Thepha": { lat: 6.8333, lng: 100.9500 }
    }
  },

  "Vietnam": {
    "Ho Chi Minh": {
      "District 1": { lat: 10.7769, lng: 106.7009 },
      "District 3": { lat: 10.7830, lng: 106.6884 },
      "District 5": { lat: 10.7554, lng: 106.6670 },
      "District 7": { lat: 10.7314, lng: 106.7224 },
      "Thu Duc": { lat: 10.8494, lng: 106.7537 },
      "Binh Thanh": { lat: 10.8106, lng: 106.7091 }
    },
    "Hanoi": {
      "Hoan Kiem": { lat: 21.0285, lng: 105.8542 },
      "Tay Ho": { lat: 21.0637, lng: 105.8204 },
      "Ba Dinh": { lat: 21.0333, lng: 105.8333 },
      "Dong Da": { lat: 21.0167, lng: 105.8333 },
      "Hai Ba Trung": { lat: 21.0083, lng: 105.8500 },
      "Cau Giay": { lat: 21.0333, lng: 105.8000 }
    },
    "Da Nang": {
      "Hai Chau": { lat: 16.0544, lng: 108.2022 },
      "Thanh Khe": { lat: 16.0667, lng: 108.1833 },
      "Son Tra": { lat: 16.1000, lng: 108.2500 },
      "Ngu Hanh Son": { lat: 15.9833, lng: 108.2667 },
      "Lien Chieu": { lat: 16.0833, lng: 108.1500 },
      "Cam Le": { lat: 16.0167, lng: 108.2167 }
    },
    "Can Tho": {
      "Ninh Kieu": { lat: 10.0452, lng: 105.7469 },
      "O Mon": { lat: 10.1167, lng: 105.6333 },
      "Binh Thuy": { lat: 10.0833, lng: 105.7333 },
      "Cai Rang": { lat: 10.0000, lng: 105.7833 },
      "Thot Not": { lat: 10.2667, lng: 105.5167 },
      "Vinh Thanh": { lat: 10.1833, lng: 105.6500 }
    },
    "Hai Phong": {
      "Hong Bang": { lat: 20.8561, lng: 106.6822 },
      "Ngo Quyen": { lat: 20.8583, lng: 106.6833 },
      "Le Chan": { lat: 20.8500, lng: 106.7000 },
      "Hai An": { lat: 20.8333, lng: 106.6667 },
      "Kien An": { lat: 20.8000, lng: 106.6167 },
      "Do Son": { lat: 20.7167, lng: 106.7667 }
    },
    "An Giang": {
      "Long Xuyen": { lat: 10.3864, lng: 105.4353 },
      "Chau Doc": { lat: 10.7000, lng: 105.1167 },
      "Tan Chau": { lat: 10.8167, lng: 105.2167 },
      "An Phu": { lat: 10.9167, lng: 105.0833 },
      "Chau Phu": { lat: 10.7500, lng: 105.1333 },
      "Chau Thanh": { lat: 10.5833, lng: 105.3667 }
    },
    "Khanh Hoa": {
      "Nha Trang": { lat: 12.2388, lng: 109.1967 },
      "Cam Ranh": { lat: 11.9167, lng: 109.1500 },
      "Cam Lam": { lat: 12.0000, lng: 109.2000 },
      "Van Ninh": { lat: 12.7167, lng: 109.2500 },
      "Dien Khanh": { lat: 12.2667, lng: 109.0833 },
      "Khanh Vinh": { lat: 12.2833, lng: 108.8333 }
    },
    "Lam Dong": {
      "Da Lat": { lat: 11.9465, lng: 108.4419 },
      "Bao Loc": { lat: 11.5333, lng: 107.8000 },
      "Don Duong": { lat: 11.7833, lng: 108.5500 },
      "Lac Duong": { lat: 12.0167, lng: 108.4833 },
      "Dam Rong": { lat: 12.0833, lng: 108.3333 },
      "Lam Ha": { lat: 11.8000, lng: 108.2000 }
    }
  },

  "Malaysia": {
    "Selangor": {
      "Petaling Jaya": { lat: 3.1073, lng: 101.6067 },
      "Shah Alam": { lat: 3.0733, lng: 101.5181 },
      "Subang Jaya": { lat: 3.0438, lng: 101.5806 },
      "Klang": { lat: 3.0449, lng: 101.4456 },
      "Ampang": { lat: 3.1500, lng: 101.7667 },
      "Kajang": { lat: 2.9927, lng: 101.7908 }
    },
    "Kuala Lumpur": {
      "Bukit Bintang": { lat: 3.1491, lng: 101.7073 },
      "KLCC": { lat: 3.1579, lng: 101.7116 },
      "Bangsar": { lat: 3.1333, lng: 101.6667 },
      "Mont Kiara": { lat: 3.1667, lng: 101.6500 },
      "Damansara": { lat: 3.1500, lng: 101.6167 },
      "Cheras": { lat: 3.0833, lng: 101.7333 }
    },
    "Johor": {
      "Johor Bahru": { lat: 1.4927, lng: 103.7414 },
      "Iskandar Puteri": { lat: 1.4167, lng: 103.6500 },
      "Pasir Gudang": { lat: 1.4667, lng: 103.9000 },
      "Kulai": { lat: 1.6667, lng: 103.6000 },
      "Batu Pahat": { lat: 1.8500, lng: 102.9333 },
      "Muar": { lat: 2.0500, lng: 102.5667 }
    },
    "Penang": {
      "George Town": { lat: 5.4149, lng: 100.3298 },
      "Butterworth": { lat: 5.4000, lng: 100.3667 },
      "Bayan Lepas": { lat: 5.2833, lng: 100.2833 },
      "Batu Ferringhi": { lat: 5.4667, lng: 100.2500 },
      "Gurney": { lat: 5.4333, lng: 100.3167 },
      "Tanjung Bungah": { lat: 5.4500, lng: 100.2833 }
    },
    "Sabah": {
      "Kota Kinabalu": { lat: 5.9804, lng: 116.0735 },
      "Sandakan": { lat: 5.8394, lng: 118.1172 },
      "Tawau": { lat: 4.2447, lng: 117.8911 },
      "Lahad Datu": { lat: 5.0333, lng: 118.3167 },
      "Keningau": { lat: 5.3333, lng: 116.1667 },
      "Papar": { lat: 5.7333, lng: 115.9333 }
    },
    "Sarawak": {
      "Kuching": { lat: 1.5533, lng: 110.3442 },
      "Miri": { lat: 4.3995, lng: 113.9914 },
      "Sibu": { lat: 2.2870, lng: 111.8303 },
      "Bintulu": { lat: 3.1667, lng: 113.0333 },
      "Limbang": { lat: 4.7500, lng: 115.0000 },
      "Sarikei": { lat: 2.1167, lng: 111.5167 }
    },
    "Perak": {
      "Ipoh": { lat: 4.5975, lng: 101.0901 },
      "Taiping": { lat: 4.8500, lng: 100.7333 },
      "Teluk Intan": { lat: 4.0167, lng: 101.0167 },
      "Sitiawan": { lat: 4.2167, lng: 100.7000 },
      "Kampar": { lat: 4.3167, lng: 101.1500 },
      "Batu Gajah": { lat: 4.4667, lng: 101.0500 }
    },
    "Melaka": {
      "Melaka City": { lat: 2.1896, lng: 102.2501 },
      "Alor Gajah": { lat: 2.3833, lng: 102.2167 },
      "Jasin": { lat: 2.3167, lng: 102.4333 },
      "Masjid Tanah": { lat: 2.3500, lng: 102.1167 },
      "Pulau Sebang": { lat: 2.4500, lng: 102.2500 },
      "Tampin": { lat: 2.4667, lng: 102.2333 }
    },
    "Negeri Sembilan": {
      "Seremban": { lat: 2.7259, lng: 101.9378 },
      "Nilai": { lat: 2.8167, lng: 101.8000 },
      "Port Dickson": { lat: 2.5167, lng: 101.8000 },
      "Rembau": { lat: 2.5833, lng: 102.0833 },
      "Tampin": { lat: 2.4667, lng: 102.2333 },
      "Jempol": { lat: 2.8833, lng: 102.4000 }
    },
    "Pahang": {
      "Kuantan": { lat: 3.8167, lng: 103.3333 },
      "Temerloh": { lat: 3.4500, lng: 102.4167 },
      "Bentong": { lat: 3.5167, lng: 101.9167 },
      "Raub": { lat: 3.8000, lng: 101.8500 },
      "Mentakab": { lat: 3.4833, lng: 102.3500 },
      "Jerantut": { lat: 3.9333, lng: 102.3667 }
    }
  }
};

