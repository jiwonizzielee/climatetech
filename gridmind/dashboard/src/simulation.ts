/**
 * KineticKin P2P Energy Simulation Engine
 * Real household data from gridmind_household_{1,2,3}_72h_15min.csv
 * 15-minute resolution · 72-hour horizon · 288 steps
 *
 * Stage 1 — Individual battery balancing (self-sufficiency first)
 * Stage 2 — Community P2P sharing with fairness coefficient α = min(1, S/D)
 * Stage 3 — Grid interaction + dynamic community pricing (Clean_Factor)
 */

// ─── Time constants ──────────────────────────────────────────────────────────

export const INTERVAL_H    = 0.25;  // 15 minutes in hours
export const STEPS_PER_DAY = 96;    // 24 h × 4 steps/h
export const N_DAYS        = 3;
export const N_STEPS       = N_DAYS * STEPS_PER_DAY; // 288

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HouseConfig {
  id: number;
  name: string;
  type: string;
  solarKw: number;
  hasBattery: boolean;
  batteryMaxKwh: number;
  color: string;
  cssVar: string;
  loadProfile: number[];   // kept for interface compat (unused in sim)
  solarProfile: number[];  // kept for interface compat (unused in sim)
}

export interface HourHouseResult {
  houseId: number;
  solarKw: number;          // instantaneous power kW (for display)
  loadKw: number;           // instantaneous power kW (for display)
  solarKwh: number;         // energy this step = solarKw × INTERVAL_H
  loadKwh: number;          // energy this step = loadKw × INTERVAL_H
  initialNetKwh: number;    // solarKwh − loadKwh
  socBefore: number;
  socAfter: number;
  batteryDeltaKwh: number;  // + = charged, − = discharged
  stage1NetKwh: number;     // net after battery action
  p2pSentKwh: number;
  p2pReceivedKwh: number;
  gridImportKwh: number;
  gridCost: number;
  p2pRevenue: number;       // seller credit
  netCost: number;          // gridCost − p2pRevenue
  gridImportNoP2PKwh: number;
  costNoP2P: number;
  role: 'seller' | 'buyer' | 'balanced';
}

export interface HourResult {
  step: number;          // 0–287
  day: number;           // 1, 2, 3 (block of 96 steps)
  hourOfDay: number;     // 0–23 (actual hour from CSV)
  minute: number;        // 0, 15, 30, 45
  label: string;         // "D1 17:15"
  gridPrice: number;
  communityPrice: number;
  cleanFactor: number;
  alpha: number;
  sharedLocallyKwh: number;
  gridSellKwh: number;
  gridImportKwh: number;
  gridImportNoP2PKwh: number;
  independenceScore: number;
  independenceNoP2P: number;
  totalSolarKw: number;  // community solar power (for charts)
  totalLoadKw: number;   // community load power  (for charts)
  totalSolarKwh: number; // energy this step
  totalLoadKwh: number;
  houses: HourHouseResult[];
}

export interface HouseSummary {
  id: number;
  name: string;
  totalSentKwh: number;
  totalReceivedKwh: number;
  totalRevenue: number;
  netCost: number;
  costNoP2P: number;
  p2pSaved: number;
  sellerSteps: number;
  buyerSteps: number;
}

export interface SimSummary {
  totalSharedKwh: number;
  totalGridKwh: number;
  totalGridNoP2PKwh: number;
  gridSavedKwh: number;
  avgIndependence: number;
  totalCostWithP2P: number;
  totalCostWithoutP2P: number;
  moneySaved: number;
  perHouse: HouseSummary[];
}

export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  solarMult: number;
  loadMult: number;
  priceMult: number;
}

// ─── Real household data (from householddata/*.csv) ──────────────────────────
// 288 values each — 72h at 15-min resolution starting Dec 16 17:15

// Actual hour-of-day and minute for each of the 288 steps (same across all houses)
const CSV_HOURS: number[] = [17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 22, 22, 22, 22, 23, 23, 23, 23, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 22, 22, 22, 22, 23, 23, 23, 23, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 22, 22, 22, 22, 23, 23, 23, 23, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17];
const CSV_MINUTES: number[] = [15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0, 15, 30, 45, 0];

// Household 1 — High Solar Prosumer (peak 7.67 kW solar, battery-backed)
const H1_DEMAND: number[] = [5.2806, 4.5169, 4.7531, 4.9474, 4.0871, 3.392, 4.2288, 4.0095, 3.682, 3.8304, 3.5288, 3.5364, 3.6714, 3.1701, 3.1769, 3.1718, 3.1827, 3.4054, 3.2478, 3.0267, 2.4233, 2.0242, 2.1027, 1.7777, 1.8093, 2.0823, 2.2004, 2.3082, 1.6499, 1.6653, 1.7986, 4.129, 3.6327, 3.171, 2.7914, 1.444, 1.6631, 1.3642, 1.4747, 1.6901, 1.6933, 1.7543, 1.6093, 1.6709, 1.52, 2.6053, 2.694, 3.0235, 1.7439, 1.5162, 1.7733, 1.59, 1.9996, 1.1263, 0.4406, 0.4332, 2.2046, 1.6901, 2.0667, 1.8482, 1.7783, 1.9739, 1.8572, 4.1415, 1.9714, 2.1946, 1.8174, 2.8445, 2.353, 4.9273, 4.4994, 2.6733, 2.8535, 2.9228, 1.6055, 1.9277, 2.1119, 1.9709, 1.728, 1.4329, 1.4309, 1.7103, 2.0595, 1.8675, 2.0934, 2.0704, 2.2241, 2.0899, 2.6906, 4.0069, 3.2448, 2.9689, 3.718, 3.4305, 3.0441, 3.5367, 3.8708, 3.5945, 3.7715, 3.6019, 4.0698, 3.7748, 4.2055, 3.4181, 2.4085, 3.6013, 3.6266, 2.9403, 4.0988, 3.9487, 3.4314, 3.5204, 3.44, 3.9474, 3.4696, 3.1905, 1.8242, 1.3029, 1.056, 0.6225, 0.3825, 0.4089, 0.3877, 0.2326, 0.3513, 0.2616, 0.2642, 0.3125, 0.316, 0.342, 0.2385, 0.2948, 0.25, 0.2944, 0.2749, 0.3433, 0.3707, 0.2181, 0.3296, 0.2429, 1.2379, 1.5222, 1.0937, 0.3763, 0.285, 0.3183, 0.2011, 0.3055, 0.2456, 0.2717, 1.6273, 0.7418, 2.3312, 3.9249, 2.8225, 2.3391, 2.6031, 1.3599, 2.0626, 2.7184, 1.2507, 1.3559, 1.3677, 1.2644, 1.3486, 1.3834, 1.3471, 1.5378, 1.4824, 1.5318, 1.6643, 1.5595, 1.7126, 2.2995, 1.4341, 1.7791, 1.7998, 1.8281, 1.5288, 1.6017, 1.8951, 1.7686, 1.7444, 1.947, 1.661, 1.9355, 1.7538, 1.6701, 1.6014, 2.0111, 2.161, 2.1616, 2.6597, 2.2268, 2.4179, 2.992, 2.4826, 2.3318, 2.7241, 1.6056, 4.3815, 3.6727, 2.0634, 2.4294, 3.5432, 3.373, 3.8154, 3.5992, 2.362, 2.4901, 1.8012, 1.702, 1.6401, 1.6459, 2.8668, 2.2168, 1.9923, 1.5054, 0.4394, 0.3866, 0.3265, 1.0942, 1.5044, 0.4381, 0.2945, 0.2919, 0.3513, 0.3512, 0.329, 0.3018, 0.2866, 0.349, 0.255, 0.3215, 0.3384, 0.3111, 0.3949, 0.2722, 0.2813, 0.3608, 0.241, 0.3283, 0.309, 0.2748, 0.3566, 0.3498, 2.1207, 0.691, 0.6563, 2.8081, 2.8548, 3.8375, 2.6931, 3.0799, 5.989, 3.9013, 1.9202, 0.3658, 0.2942, 0.322, 0.2426, 0.4901, 0.5574, 3.3304, 2.0096, 1.7418, 1.9924, 0.7797, 0.3109, 0.3032, 0.2712, 0.2855, 0.3873, 0.2173, 0.292, 0.333, 0.3283, 0.3227, 0.2263, 0.2937, 0.2623, 0.2195, 1.0001, 1.2479, 1.5938, 1.2616, 1.2868, 1.5925];
const H1_SOLAR: number[] = [1.3848, 0.8852, 0.4531, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.439, 0.9248, 1.3824, 1.7658, 2.1971, 2.7099, 2.8719, 3.2537, 3.7493, 4.2159, 4.6872, 5.3149, 5.4886, 5.5091, 5.8148, 5.7583, 6.2723, 6.3738, 6.7355, 6.4818, 7.0438, 7.472, 6.947, 7.1406, 7.226, 6.8009, 6.9424, 6.7657, 6.6609, 6.2172, 6.2858, 6.2131, 6.2426, 5.8198, 5.8295, 4.7598, 4.8167, 4.3004, 4.3148, 3.3585, 2.966, 2.5985, 2.0111, 1.7641, 1.3138, 0.9206, 0.4656, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4951, 0.8506, 1.2493, 1.8067, 2.2933, 2.6744, 2.776, 3.4844, 3.6353, 4.404, 4.7, 4.7171, 5.1277, 5.2594, 5.802, 6.3517, 5.9687, 6.6301, 6.4528, 6.4934, 6.8288, 6.5809, 6.7917, 6.5807, 7.6712, 6.9524, 6.6253, 6.8338, 6.5913, 6.3957, 6.4709, 6.2918, 5.6659, 5.3936, 5.1905, 4.3801, 4.2658, 4.5526, 4.2089, 3.4564, 3.1853, 2.7205, 2.5965, 1.9132, 1.3569, 0.87, 0.421, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4563, 0.8584, 1.3211, 1.816, 2.1533, 2.6273, 3.2518, 3.399, 4.0515, 4.0206, 4.7377, 5.3065, 4.6125, 5.3322, 5.9882, 6.0006, 6.3946, 6.2719, 6.6572, 6.7089, 7.2664, 7.0284, 7.1029, 6.8558, 6.8147, 6.79, 7.0009, 6.6192, 6.7245, 7.1383, 6.5516, 5.9634, 6.1699, 5.4402, 4.7266, 4.7003, 4.1837, 4.1864, 3.8926, 3.7934, 3.1466, 2.6494, 2.3434, 1.6114];

// Household 2 — Medium Solar + High Evening Load
const H2_DEMAND: number[] = [9.1067, 7.4947, 7.0868, 7.2432, 7.175, 5.8547, 6.2735, 6.1767, 6.096, 5.7742, 6.5604, 5.8786, 6.3983, 6.4394, 6.1887, 5.2687, 5.7187, 5.4993, 5.3529, 5.5549, 3.4106, 3.6221, 3.3546, 2.4592, 2.3777, 2.5455, 3.0585, 2.7413, 2.2513, 1.9476, 2.3502, 5.1854, 4.2717, 4.0602, 3.4277, 1.9687, 2.0964, 1.9892, 2.0793, 2.227, 2.0767, 2.1391, 2.1074, 2.3695, 2.0684, 3.2046, 3.6932, 3.5283, 1.8574, 2.2273, 2.1045, 2.0234, 2.6572, 1.3735, 0.5407, 0.4994, 2.9912, 2.119, 2.6453, 2.2631, 2.1602, 2.6577, 2.4065, 5.8476, 2.4014, 2.8166, 2.2511, 3.2834, 2.8755, 6.2906, 5.769, 2.7626, 3.3485, 3.126, 2.5169, 2.532, 2.6097, 2.4833, 2.1572, 2.1754, 1.7117, 2.1229, 2.503, 2.4818, 2.7814, 2.8286, 2.2079, 2.666, 3.3373, 4.3253, 4.1562, 3.7964, 4.8118, 4.6242, 4.2738, 6.8925, 6.8833, 6.0911, 6.2406, 5.4411, 7.2201, 6.0581, 7.9966, 5.8545, 4.0369, 5.9852, 5.3822, 5.2823, 6.4024, 6.6119, 6.105, 5.3498, 5.4404, 5.6542, 5.6348, 4.9491, 2.758, 2.2971, 1.4813, 0.7785, 0.4588, 0.4934, 0.4387, 0.3032, 0.4323, 0.3122, 0.3117, 0.4071, 0.3889, 0.4586, 0.3329, 0.3504, 0.3274, 0.3407, 0.3871, 0.3932, 0.5416, 0.277, 0.3761, 0.2981, 1.3614, 1.5966, 1.5372, 0.4794, 0.3175, 0.4004, 0.2636, 0.4183, 0.3265, 0.3516, 1.9717, 0.8598, 2.6458, 4.6299, 3.4232, 2.8739, 2.9033, 1.6605, 2.7392, 3.1417, 1.6773, 1.6614, 1.4939, 1.8031, 1.5842, 1.6894, 1.6729, 1.75, 1.9882, 2.04, 2.1169, 2.0941, 2.0031, 2.835, 1.7598, 2.0922, 2.2307, 1.8645, 1.8779, 1.7308, 2.3051, 2.187, 2.5071, 2.2424, 2.2269, 2.3795, 2.049, 2.3202, 1.9578, 2.9177, 2.9423, 3.2514, 4.6883, 3.906, 4.0113, 4.8939, 4.285, 3.9922, 4.686, 2.5423, 7.6209, 5.2706, 3.3902, 4.0194, 5.9477, 5.744, 5.6936, 5.6789, 3.7055, 3.4885, 3.0951, 2.8453, 2.4699, 2.5772, 4.3284, 2.5222, 2.7627, 2.0939, 0.5238, 0.4637, 0.3578, 1.5662, 1.7184, 0.6218, 0.3681, 0.3422, 0.4518, 0.4695, 0.4184, 0.3601, 0.3727, 0.4211, 0.3129, 0.4583, 0.3874, 0.368, 0.5853, 0.3298, 0.3919, 0.4385, 0.3143, 0.4243, 0.3395, 0.3044, 0.4459, 0.45, 3.0123, 1.0194, 0.7702, 3.5298, 3.4433, 4.3985, 2.845, 3.4903, 8.1541, 4.8802, 1.9658, 0.4989, 0.3351, 0.3902, 0.3611, 0.5809, 0.7337, 4.3595, 2.7192, 2.63, 2.101, 1.0979, 0.388, 0.3736, 0.3615, 0.3553, 0.4594, 0.2791, 0.4131, 0.4074, 0.413, 0.4087, 0.2862, 0.3681, 0.3378, 0.258, 1.1673, 1.682, 1.8855, 1.7807, 1.4506, 2.7265];
const H2_SOLAR: number[] = [0.745, 0.505, 0.2538, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2368, 0.5277, 0.7804, 0.993, 1.3281, 1.6025, 1.627, 1.9237, 2.1368, 2.3206, 2.7468, 2.801, 2.9676, 2.8555, 3.4315, 3.2495, 3.5982, 3.7468, 4.0454, 3.6109, 3.3308, 4.0022, 4.3508, 4.2478, 4.0333, 3.8683, 4.0815, 3.6756, 3.8779, 3.7889, 3.7777, 3.9421, 3.3911, 3.0927, 3.0035, 2.5782, 2.5458, 2.3852, 2.164, 2.0152, 1.6964, 1.6165, 1.2858, 1.0348, 0.7676, 0.5262, 0.2724, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2665, 0.4986, 0.7464, 1.0935, 1.2093, 1.6565, 1.6895, 2.0638, 2.1858, 2.5085, 2.5656, 2.8054, 3.0135, 3.0144, 3.4491, 3.3752, 3.5465, 3.5118, 3.3025, 3.8268, 4.3964, 4.1214, 3.9876, 3.9474, 3.9959, 4.0743, 3.6915, 4.079, 3.9232, 3.8282, 3.6661, 3.4675, 3.4378, 3.2673, 2.9541, 2.7473, 2.6508, 2.6236, 2.0846, 1.8532, 1.7837, 1.5346, 1.2969, 1.0479, 0.7717, 0.561, 0.2407, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2672, 0.5226, 0.7553, 1.0605, 1.4018, 1.5161, 1.8328, 1.8707, 2.116, 2.4926, 2.8331, 2.8787, 2.9603, 3.1733, 3.1179, 3.5688, 3.7458, 3.612, 3.6987, 3.9151, 3.8375, 3.9527, 4.4105, 3.9506, 3.9199, 3.8374, 4.0691, 3.8287, 3.6647, 3.9397, 3.8421, 3.3601, 3.0155, 3.3333, 2.9044, 2.9402, 2.3776, 2.5437, 2.0877, 2.0731, 1.7704, 1.4577, 1.2596, 1.0708];

// Household 3 — Low Solar, High Load Consumer
const H3_DEMAND: number[] = [10.7667, 9.2268, 8.9784, 9.9965, 9.1826, 6.5547, 8.8856, 8.3265, 8.6244, 7.1629, 6.9977, 7.5717, 7.8288, 8.331, 7.7568, 6.793, 6.6778, 7.537, 6.7958, 7.623, 4.5978, 4.7205, 4.5771, 2.699, 2.537, 2.8367, 3.3941, 3.1749, 2.3109, 2.3493, 2.6247, 4.5379, 5.2298, 4.4616, 3.4665, 1.9605, 2.052, 1.9884, 2.1479, 2.6126, 2.1984, 2.4569, 2.3233, 2.401, 2.3243, 3.5387, 4.2164, 4.4121, 2.1506, 2.228, 2.3944, 2.1468, 3.0066, 1.4545, 0.6564, 0.6154, 3.2915, 2.5594, 3.0252, 2.3617, 2.4378, 2.8077, 2.9289, 6.2985, 2.3826, 2.7044, 2.5441, 3.7391, 3.6059, 6.5793, 6.3524, 3.7326, 4.5491, 3.65, 2.7455, 2.6598, 2.9758, 2.793, 2.4689, 1.9316, 2.1131, 2.3619, 2.6131, 3.0299, 2.9555, 2.9163, 3.3043, 2.726, 3.7621, 5.3941, 4.7442, 3.9772, 5.0126, 4.7426, 4.2054, 8.1043, 8.1908, 7.6185, 7.074, 8.1617, 9.4813, 8.808, 9.2573, 8.0394, 5.2502, 7.9801, 7.056, 6.0748, 9.6322, 8.7739, 8.4239, 6.8376, 6.6416, 7.349, 7.4357, 6.3385, 3.8714, 3.2228, 2.1619, 0.7768, 0.5079, 0.5763, 0.489, 0.3468, 0.4615, 0.2993, 0.3903, 0.4376, 0.3625, 0.5546, 0.3922, 0.4018, 0.3743, 0.3726, 0.4487, 0.4899, 0.5496, 0.3305, 0.4446, 0.3377, 1.6674, 1.9917, 1.6483, 0.5142, 0.3908, 0.4235, 0.305, 0.4349, 0.319, 0.3449, 2.3762, 0.8888, 3.6381, 5.8701, 3.8128, 2.887, 3.2064, 1.844, 2.9213, 3.5483, 2.0305, 1.885, 1.691, 1.6833, 1.7499, 1.8658, 1.8507, 1.8708, 2.171, 2.507, 2.5818, 2.289, 2.3823, 3.0872, 2.1148, 2.2836, 2.5246, 2.3613, 2.1094, 1.769, 2.6067, 2.6008, 2.6881, 2.5644, 2.5297, 2.4617, 2.6327, 2.1022, 2.4235, 3.1853, 2.9604, 4.4275, 5.9378, 4.3817, 5.1769, 5.2225, 5.1865, 5.3262, 5.5018, 3.365, 8.9008, 8.3874, 3.6215, 4.4957, 8.8399, 8.3422, 7.7238, 6.7871, 5.4166, 4.6536, 3.8062, 3.183, 3.2481, 3.2944, 6.2581, 3.2268, 3.0792, 1.9997, 0.6859, 0.5487, 0.4179, 1.877, 1.888, 0.6776, 0.4108, 0.3475, 0.5002, 0.6049, 0.4281, 0.4052, 0.4358, 0.4859, 0.3536, 0.4318, 0.4257, 0.4006, 0.5466, 0.4039, 0.4337, 0.482, 0.3592, 0.4926, 0.4255, 0.3855, 0.5284, 0.539, 3.1149, 1.0186, 0.7675, 3.9041, 4.1079, 4.8971, 3.1809, 3.8006, 10.4018, 6.0745, 2.7862, 0.4956, 0.4029, 0.3974, 0.3447, 0.6507, 1.0409, 4.8498, 3.0399, 2.7315, 2.8917, 1.0881, 0.4808, 0.4501, 0.329, 0.4638, 0.517, 0.2999, 0.4129, 0.434, 0.51, 0.4687, 0.3303, 0.401, 0.3477, 0.3147, 1.175, 1.8402, 1.9821, 2.0139, 1.7986, 3.307];
const H3_SOLAR: number[] = [0.4037, 0.2706, 0.1244, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1356, 0.2688, 0.3874, 0.5264, 0.676, 0.7987, 0.834, 1.041, 1.1075, 1.222, 1.3235, 1.4036, 1.5933, 1.5801, 1.5699, 1.698, 1.8098, 1.9613, 1.951, 1.8497, 2.2053, 2.0091, 2.123, 1.9848, 2.0489, 2.0661, 2.081, 2.034, 1.9765, 1.8186, 1.7425, 1.7609, 1.7405, 1.569, 1.5838, 1.5169, 1.2583, 1.1666, 1.1033, 1.0154, 0.8614, 0.8171, 0.6565, 0.5187, 0.3622, 0.2439, 0.1326, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1255, 0.2718, 0.3946, 0.5181, 0.6115, 0.8152, 0.914, 0.9724, 1.1668, 1.1872, 1.2671, 1.3605, 1.3705, 1.6241, 1.5107, 1.6257, 1.6076, 1.8398, 1.8796, 1.9003, 1.8593, 1.8667, 2.0421, 1.9449, 2.0273, 1.8951, 1.9793, 2.0577, 1.9494, 1.8097, 1.8168, 1.7112, 1.6636, 1.5609, 1.4913, 1.4292, 1.2532, 1.1557, 1.034, 0.92, 0.8307, 0.7715, 0.6142, 0.5309, 0.3909, 0.2354, 0.1351, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1261, 0.2585, 0.3814, 0.4972, 0.6427, 0.7571, 0.8681, 0.9636, 1.1289, 1.3182, 1.3279, 1.4846, 1.3992, 1.5992, 1.5717, 1.6041, 1.7274, 1.9579, 1.9838, 1.9553, 1.8112, 1.9634, 2.0258, 2.0176, 1.8117, 1.8946, 1.9553, 1.9837, 1.6859, 1.8328, 1.8066, 1.8056, 1.7205, 1.6329, 1.4435, 1.2793, 1.2928, 1.2785, 1.1886, 1.0355, 0.9036, 0.7799, 0.625, 0.5143];

// Lookup table: CSV demand/solar by house index (0-based)
const CSV_DEMAND = [H1_DEMAND, H2_DEMAND, H3_DEMAND];
const CSV_SOLAR  = [H1_SOLAR,  H2_SOLAR,  H3_SOLAR];

// ─── House configuration ──────────────────────────────────────────────────────

export const HOUSES: HouseConfig[] = [
  {
    id: 1,
    name: 'Household 1',
    type: 'High-Solar Prosumer · Battery-Backed',
    solarKw: 7.7,         // peak observed in CSV (kW)
    hasBattery: true,
    batteryMaxKwh: 10.0,
    color: '#00d4b8',
    cssVar: 'var(--teal)',
    loadProfile: [],      // not used — real data from CSV_DEMAND
    solarProfile: [],
  },
  {
    id: 2,
    name: 'Household 2',
    type: 'Medium-Solar · High Evening Load',
    solarKw: 4.4,
    hasBattery: false,
    batteryMaxKwh: 0,
    color: '#f59e0b',
    cssVar: 'var(--amber)',
    loadProfile: [],
    solarProfile: [],
  },
  {
    id: 3,
    name: 'Household 3',
    type: 'Low-Solar · High-Consumption',
    solarKw: 2.2,
    hasBattery: false,
    batteryMaxKwh: 0,
    color: '#8b5cf6',
    cssVar: 'var(--purple)',
    loadProfile: [],
    solarProfile: [],
  },
];

// ─── TOU grid prices $/kWh (indexed by hour-of-day) ──────────────────────────

export const GRID_PRICES: number[] = [
  0.09, 0.09, 0.09, 0.09, 0.09, 0.09,
  0.15, 0.15,
  0.25, 0.25, 0.25, 0.25,
  0.25, 0.25,
  0.35, 0.35, 0.35, 0.35,
  0.35, 0.35,
  0.25, 0.25,
  0.15, 0.09,
];

// ─── Dynamic community pricing ────────────────────────────────────────────────

function cleanFactor(hourOfDay: number): number {
  if (hourOfDay >= 10 && hourOfDay <= 16) return 0.5;
  if (hourOfDay >= 17 && hourOfDay <= 21) return 0.8;
  return 0.9;
}

// ─── Core simulation ─────────────────────────────────────────────────────────

export function runSimulation(
  solarMult = 1.0,
  loadMult  = 1.0,
  priceMult = 1.0,
): HourResult[] {
  // Battery SOC persists across all 288 steps
  const soc: Record<number, number> = {};
  for (const h of HOUSES) {
    soc[h.id] = h.hasBattery ? h.batteryMaxKwh * 0.5 : 0;
  }

  const results: HourResult[] = [];

  for (let s = 0; s < N_STEPS; s++) {
    const dayIdx    = Math.floor(s / STEPS_PER_DAY);
    const day       = dayIdx + 1;
    const hourOfDay = CSV_HOURS[s];
    const minute    = CSV_MINUTES[s];
    const label     = `D${day} ${String(hourOfDay).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const gridPrice      = +(GRID_PRICES[hourOfDay] * priceMult).toFixed(4);
    const cf             = cleanFactor(hourOfDay);
    const communityPrice = +(gridPrice * cf).toFixed(4);

    // ── Stage 1: Individual home balancing ─────────────────────────────────
    const s1: Array<{
      house: HouseConfig;
      solarKw: number; loadKw: number;
      solarKwh: number; loadKwh: number;
      initialNetKwh: number;
      socBefore: number; socAfter: number; batteryDeltaKwh: number;
      stage1NetKwh: number;
    }> = [];

    for (let hi = 0; hi < HOUSES.length; hi++) {
      const house   = HOUSES[hi];
      const solarKw = +(CSV_SOLAR[hi][s]  * solarMult).toFixed(3);
      const loadKw  = +(CSV_DEMAND[hi][s] * loadMult ).toFixed(3);
      const solarKwh      = +(solarKw * INTERVAL_H).toFixed(4);
      const loadKwh       = +(loadKw  * INTERVAL_H).toFixed(4);
      const initialNetKwh = +(solarKwh - loadKwh).toFixed(4);

      const socBefore = soc[house.id];
      let stage1NetKwh    = initialNetKwh;
      let socAfter        = socBefore;
      let batteryDeltaKwh = 0;

      if (house.hasBattery) {
        if (initialNetKwh < 0) {
          const discharge  = Math.min(Math.abs(initialNetKwh), socBefore);
          stage1NetKwh    = +(initialNetKwh + discharge).toFixed(4);
          batteryDeltaKwh = -discharge;
          socAfter        = +(socBefore - discharge).toFixed(4);
        } else {
          const space     = house.batteryMaxKwh - socBefore;
          const charge    = Math.min(initialNetKwh, space);
          stage1NetKwh   = +(initialNetKwh - charge).toFixed(4);
          batteryDeltaKwh = +charge.toFixed(4);
          socAfter        = +(socBefore + charge).toFixed(4);
        }
      }

      soc[house.id] = socAfter;
      s1.push({ house, solarKw, loadKw, solarKwh, loadKwh, initialNetKwh, socBefore, socAfter, batteryDeltaKwh, stage1NetKwh });
    }

    // ── Stage 2: Community P2P sharing ─────────────────────────────────────
    const sellers = s1.filter(r => r.stage1NetKwh >  0.0001);
    const buyers  = s1.filter(r => r.stage1NetKwh < -0.0001);

    const sTotal = +sellers.reduce((a, r) => a + r.stage1NetKwh,          0).toFixed(4);
    const dTotal = +buyers .reduce((a, r) => a + Math.abs(r.stage1NetKwh), 0).toFixed(4);

    const alpha     = dTotal > 0 ? Math.min(1, sTotal / dTotal) : 0;
    const sendRatio = sTotal > 0 ? Math.min(1, dTotal / sTotal) : 0;

    const sharedLocallyKwh = +Math.min(sTotal, dTotal).toFixed(4);
    const gridSellKwh      = +(sTotal - sharedLocallyKwh).toFixed(4);

    // ── Stage 3: Grid interaction + per-house accounting ───────────────────
    const houseResults: HourHouseResult[] = s1.map(r => {
      let p2pSentKwh = 0, p2pReceivedKwh = 0, gridImportKwh = 0;
      let role: 'seller' | 'buyer' | 'balanced' = 'balanced';

      if (r.stage1NetKwh > 0.0001) {
        p2pSentKwh = +(r.stage1NetKwh * sendRatio).toFixed(4);
        role = 'seller';
      } else if (r.stage1NetKwh < -0.0001) {
        const deficit = Math.abs(r.stage1NetKwh);
        p2pReceivedKwh = +(deficit * alpha).toFixed(4);
        gridImportKwh  = +(deficit - p2pReceivedKwh).toFixed(4);
        role = 'buyer';
      }

      const gridImportNoP2PKwh = r.stage1NetKwh < 0 ? +Math.abs(r.stage1NetKwh).toFixed(4) : 0;
      const gridCost   = +(gridImportKwh        * gridPrice     ).toFixed(5);
      const p2pRevenue = +(p2pSentKwh           * communityPrice).toFixed(5);
      const netCost    = +(gridCost - p2pRevenue                ).toFixed(5);
      const costNoP2P  = +(gridImportNoP2PKwh   * gridPrice     ).toFixed(5);

      return {
        houseId: r.house.id,
        solarKw: r.solarKw, loadKw: r.loadKw,
        solarKwh: r.solarKwh, loadKwh: r.loadKwh,
        initialNetKwh: r.initialNetKwh,
        socBefore: r.socBefore, socAfter: r.socAfter, batteryDeltaKwh: r.batteryDeltaKwh,
        stage1NetKwh: r.stage1NetKwh,
        p2pSentKwh, p2pReceivedKwh, gridImportKwh,
        gridCost, p2pRevenue, netCost,
        gridImportNoP2PKwh, costNoP2P,
        role,
      };
    });

    const totalSolarKwh = +s1.reduce((a, r) => a + r.solarKwh, 0).toFixed(4);
    const totalLoadKwh  = +s1.reduce((a, r) => a + r.loadKwh,  0).toFixed(4);
    const totalSolarKw  = +s1.reduce((a, r) => a + r.solarKw,  0).toFixed(3);
    const totalLoadKw   = +s1.reduce((a, r) => a + r.loadKw,   0).toFixed(3);

    const gridImportKwh      = +(dTotal * (1 - alpha)).toFixed(4);
    const gridImportNoP2PKwh = +dTotal.toFixed(4);
    const independenceScore  = totalLoadKwh > 0
      ? +((totalLoadKwh - gridImportKwh)      / totalLoadKwh * 100).toFixed(1) : 100;
    const independenceNoP2P  = totalLoadKwh > 0
      ? +((totalLoadKwh - gridImportNoP2PKwh) / totalLoadKwh * 100).toFixed(1) : 100;

    results.push({
      step: s, day, hourOfDay, minute, label,
      gridPrice, communityPrice, cleanFactor: cf,
      alpha, sharedLocallyKwh, gridSellKwh,
      gridImportKwh, gridImportNoP2PKwh,
      independenceScore, independenceNoP2P,
      totalSolarKw, totalLoadKw, totalSolarKwh, totalLoadKwh,
      houses: houseResults,
    });
  }

  return results;
}

// ─── Summary helper ───────────────────────────────────────────────────────────

export function getSummary(steps: HourResult[]): SimSummary {
  const totalSharedKwh    = +steps.reduce((a, h) => a + h.sharedLocallyKwh,   0).toFixed(2);
  const totalGridKwh      = +steps.reduce((a, h) => a + h.gridImportKwh,      0).toFixed(2);
  const totalGridNoP2PKwh = +steps.reduce((a, h) => a + h.gridImportNoP2PKwh, 0).toFixed(2);
  const gridSavedKwh      = +(totalGridNoP2PKwh - totalGridKwh).toFixed(2);
  const avgIndependence   = +(steps.reduce((a, h) => a + h.independenceScore, 0) / N_STEPS).toFixed(1);

  const perHouse: HouseSummary[] = HOUSES.map(house => {
    const hh = steps.map(s => s.houses.find(r => r.houseId === house.id)!);
    const totalSentKwh     = +hh.reduce((a, r) => a + r.p2pSentKwh,     0).toFixed(2);
    const totalReceivedKwh = +hh.reduce((a, r) => a + r.p2pReceivedKwh, 0).toFixed(2);
    const totalRevenue     = +hh.reduce((a, r) => a + r.p2pRevenue,      0).toFixed(2);
    const netCost          = +hh.reduce((a, r) => a + r.netCost,         0).toFixed(2);
    const costNoP2P        = +hh.reduce((a, r) => a + r.costNoP2P,       0).toFixed(2);
    const p2pSaved         = +(costNoP2P - netCost).toFixed(2);
    const sellerSteps      = hh.filter(r => r.role === 'seller').length;
    const buyerSteps       = hh.filter(r => r.role === 'buyer').length;
    return { id: house.id, name: house.name, totalSentKwh, totalReceivedKwh, totalRevenue, netCost, costNoP2P, p2pSaved, sellerSteps, buyerSteps };
  });

  const totalCostWithP2P    = +perHouse.reduce((a, h) => a + h.netCost,   0).toFixed(2);
  const totalCostWithoutP2P = +perHouse.reduce((a, h) => a + h.costNoP2P, 0).toFixed(2);
  const moneySaved          = +(totalCostWithoutP2P - totalCostWithP2P).toFixed(2);

  return {
    totalSharedKwh, totalGridKwh, totalGridNoP2PKwh, gridSavedKwh,
    avgIndependence,
    totalCostWithP2P, totalCostWithoutP2P, moneySaved,
    perHouse,
  };
}

// ─── Scenario presets ────────────────────────────────────────────────────────

export const SCENARIOS: ScenarioConfig[] = [
  { id: 'baseline',  name: 'Baseline',    icon: '📊', description: 'Real Dec 16–19 data — actual demand and solar as measured',   solarMult: 1.0,  loadMult: 1.0,  priceMult: 1.0  },
  { id: 'heat_wave', name: 'Heat Wave',   icon: '🔥', description: 'AC overload +50% demand, solar −15%, grid prices +40%',        solarMult: 0.85, loadMult: 1.5,  priceMult: 1.4  },
  { id: 'cloudy',    name: 'Overcast',    icon: '☁️', description: 'Solar reduced to 30% — battery and grid become critical',      solarMult: 0.30, loadMult: 1.0,  priceMult: 1.0  },
  { id: 'weekend',   name: 'Long Weekend', icon: '🏡', description: 'Everyone home — +20% daytime load, prices discounted −10%',   solarMult: 1.0,  loadMult: 1.2,  priceMult: 0.9  },
];

// ─── Pre-computed defaults ────────────────────────────────────────────────────

export const DEFAULT_SIM     = runSimulation();
export const DEFAULT_SUMMARY = getSummary(DEFAULT_SIM);
