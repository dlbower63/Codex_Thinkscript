# [JOAT] Apex Flow Engine - thinkScript port
#
# Port of the TradingView indicator "[JOAT] Apex Flow Engine"
# Original Pine Script (c) officialjackofalltrades
# https://www.tradingview.com/script/M17tBCIA-JOAT-Apex-Flow-Engine/
# Original licensed under the Mozilla Public License 2.0 (https://mozilla.org/MPL/2.0/).
# This port is a derivative work and is distributed under the same MPL 2.0 terms.
#
# Porting notes (thinkScript has no line/label/box/table objects):
#  - TP/SL/entry levels are drawn as plot lines + clouds while a trade is active.
#  - BUY/SELL labels are chart bubbles (single line, no line breaks).
#  - Dashboard is a set of chart labels in the top-left status bar.
#  - Gradient candle/ribbon transparency is approximated by blending colors
#    toward dark gray by Flow Quality (candles); the ribbon is a flat cloud.

declare upper;

# ============================ INPUTS ============================
input flowLen = 34;
input flowAccel = 2.0;
input envMult = 1.6;
input atrLenFlow = 14;
input confirmCloses = 1;

input useQuality = yes;
input minQuality = 60;
input volLenQ = 20;
input momLenQ = 10;

input showSignals = yes;
input showTriangles = no;
input showQualityInLabel = yes;
input richLabels = yes;

input showBaseline = yes;
input showEnvelope = yes;
input showRibbon = yes;
input candleStyle = {default Gradient, Solid, TwoTone, None};

input showTargets = yes;
input useAtrSL = yes;
input tpAtrPeriod = 14;
input slAtrMult = 1.5;
input slPercent = 1.0;
input rrTP1 = 1.0;
input rrTP2 = 2.0;
input rrTP3 = 3.0;
input showSLLevel = yes;
input showTP1Level = yes;
input showTP2Level = yes;
input showTP3Level = yes;

input showDash = yes;

DefineColor("Bull", CreateColor(0, 201, 167));
DefineColor("Bear", CreateColor(255, 107, 107));

# ========================== CORE ENGINE =========================
# Efficiency-ratio adaptive baseline
def erChange = AbsValue(close - close[flowLen]);
def erNoise = Sum(AbsValue(close - close[1]), flowLen);
def efficiency = if erNoise > 0 then erChange / erNoise else 0;
def fastSC = 2.0 / (2.0 + 1.0);
def slowSC = 2.0 / (30.0 + 1.0);
def scRaw = efficiency * (fastSC - slowSC) + slowSC;
def smoothConst = Min(Power(scRaw, 2) * flowAccel, 1.0);

def flowBase = CompoundValue(1, flowBase[1] + smoothConst * (close - flowBase[1]), close);

# Envelope (Wilder ATR, same as Pine ta.atr)
def atrFlow = ATR(atrLenFlow);
def envUp = flowBase + atrFlow * envMult;
def envDn = flowBase - atrFlow * envMult;

# Flip state machine with confirmation closes
def upCloses = CompoundValue(1, if close > envUp then upCloses[1] + 1 else 0, 0);
def dnCloses = CompoundValue(1, if close < envDn then dnCloses[1] + 1 else 0, 0);
def flowDir = CompoundValue(1,
    if flowDir[1] <= 0 and upCloses >= confirmCloses then 1
    else if flowDir[1] >= 0 and dnCloses >= confirmCloses then -1
    else flowDir[1], 0);
def flipUp = flowDir == 1 and flowDir[1] != 1;
def flipDn = flowDir == -1 and flowDir[1] != -1;

def flowFlipBar = CompoundValue(1, if flipUp or flipDn then BarNumber() else flowFlipBar[1], 0);

# Flow Quality score (0-100)
def momQ = close - close[momLenQ];
def volBase = Average(volume, volLenQ);
def volRatio = if volBase > 0 then volume / volBase else 1.0;
def bodyPct = AbsValue(close - open) / Max(high - low, TickSize());

def qMomLong = if momQ > 0 then 25 else 0;
def qMomShort = if momQ < 0 then 25 else 0;
def qVol = if volRatio >= 1.2 then 25 else if volRatio >= 1.0 then 15 else 0;
def qBody = if bodyPct >= 0.6 then 25 else if bodyPct >= 0.4 then 15 else 5;
def qEff = if efficiency >= 0.4 then 25 else if efficiency >= 0.25 then 15 else 5;

def qualityLong = qMomLong + qVol + qBody + qEff;
def qualityShort = qMomShort + qVol + qBody + qEff;
def flowQuality = if flowDir == 1 then qualityLong else if flowDir == -1 then qualityShort else 0;

def longSignal = flipUp and (!useQuality or qualityLong >= minQuality);
def shortSignal = flipDn and (!useQuality or qualityShort >= minQuality);

# ============================ VISUALS ===========================
plot FlowBaseline = if showBaseline then flowBase else Double.NaN;
FlowBaseline.SetLineWeight(2);
FlowBaseline.AssignValueColor(if flowDir == 1 then Color("Bull") else if flowDir == -1 then Color("Bear") else Color.GRAY);

plot EnvelopeUpper = if showEnvelope then envUp else Double.NaN;
plot EnvelopeLower = if showEnvelope then envDn else Double.NaN;
EnvelopeUpper.AssignValueColor(if flowDir == 1 then Color("Bull") else if flowDir == -1 then Color("Bear") else Color.GRAY);
EnvelopeLower.AssignValueColor(if flowDir == 1 then Color("Bull") else if flowDir == -1 then Color("Bear") else Color.GRAY);
EnvelopeUpper.SetStyle(Curve.SHORT_DASH);
EnvelopeLower.SetStyle(Curve.SHORT_DASH);

# Ribbon between baseline and price anchor
def ribbonBull = if showRibbon and flowDir == 1 then flowBase else Double.NaN;
def ribbonBear = if showRibbon and flowDir == -1 then flowBase else Double.NaN;
def anchorBull = if showRibbon and flowDir == 1 then hl2 else Double.NaN;
def anchorBear = if showRibbon and flowDir == -1 then hl2 else Double.NaN;
AddCloud(ribbonBull, anchorBull, Color("Bull"), Color("Bull"));
AddCloud(ribbonBear, anchorBear, Color("Bear"), Color("Bear"));

# Candle coloring (Gradient = blend toward dark gray as quality falls)
def gt = Min(flowQuality, 100) / 100.0;
def bullR = 70 + (0 - 70) * gt;
def bullG = 70 + (201 - 70) * gt;
def bullB = 70 + (167 - 70) * gt;
def bearR = 70 + (255 - 70) * gt;
def bearG = 70 + (107 - 70) * gt;
def bearB = 70 + (107 - 70) * gt;
def withFlow = (flowDir == 1 and close >= open) or (flowDir == -1 and close < open);

AssignPriceColor(
    if candleStyle == candleStyle.None or flowDir == 0 then Color.CURRENT
    else if candleStyle == candleStyle.Solid then (if flowDir == 1 then Color("Bull") else Color("Bear"))
    else if candleStyle == candleStyle.TwoTone then
        (if withFlow then (if flowDir == 1 then Color("Bull") else Color("Bear")) else Color.DARK_GRAY)
    else (if flowDir == 1 then CreateColor(bullR, bullG, bullB) else CreateColor(bearR, bearG, bearB))
);

# ========================== TP / SL ENGINE ======================
def sig = (longSignal or shortSignal) and showTargets;
def dirNow = if longSignal then 1 else -1;
def riskDist = if useAtrSL then ATR(tpAtrPeriod) * slAtrMult else close * (slPercent / 100);

def entryLevel = CompoundValue(1, if sig then close else entryLevel[1], Double.NaN);
def slLevel = CompoundValue(1, if sig then close - dirNow * riskDist else slLevel[1], Double.NaN);
def tp1Level = CompoundValue(1, if sig then close + dirNow * riskDist * rrTP1 else tp1Level[1], Double.NaN);
def tp2Level = CompoundValue(1, if sig then close + dirNow * riskDist * rrTP2 else tp2Level[1], Double.NaN);
def tp3Level = CompoundValue(1, if sig then close + dirNow * riskDist * rrTP3 else tp3Level[1], Double.NaN);
def extremeLevel = CompoundValue(1,
    if sig then (if showTP3Level then tp3Level else if showTP2Level then tp2Level else if showTP1Level then tp1Level else Double.NaN)
    else extremeLevel[1], Double.NaN);

# Trade closes on SL or the furthest displayed TP (checked on bars after entry)
def tradeDir = CompoundValue(1,
    if sig then dirNow
    else if tradeDir[1] == 1 and (low <= slLevel or (!IsNaN(extremeLevel) and high >= extremeLevel)) then 0
    else if tradeDir[1] == -1 and (high >= slLevel or (!IsNaN(extremeLevel) and low <= extremeLevel)) then 0
    else tradeDir[1], 0);
def tradeActive = showTargets and (tradeDir != 0 or tradeDir[1] != 0);

plot EntryLine = if tradeActive then entryLevel else Double.NaN;
EntryLine.SetLineWeight(2);
def tradeSide = CompoundValue(1, if sig then dirNow else tradeSide[1], 0);
EntryLine.AssignValueColor(if tradeSide == 1 then Color("Bull") else Color("Bear"));

plot SL = if tradeActive and showSLLevel then slLevel else Double.NaN;
SL.SetDefaultColor(Color.PINK);
SL.SetStyle(Curve.SHORT_DASH);

plot TP1 = if tradeActive and showTP1Level then tp1Level else Double.NaN;
plot TP2 = if tradeActive and showTP2Level then tp2Level else Double.NaN;
plot TP3 = if tradeActive and showTP3Level then tp3Level else Double.NaN;
TP1.SetDefaultColor(Color.LIGHT_GREEN);
TP2.SetDefaultColor(Color.LIGHT_GREEN);
TP3.SetDefaultColor(Color.LIGHT_GREEN);
TP3.SetStyle(Curve.POINTS);

# Risk / reward fills
def riskTop = if tradeActive and showSLLevel then entryLevel else Double.NaN;
def riskBot = if tradeActive and showSLLevel then slLevel else Double.NaN;
AddCloud(riskTop, riskBot, Color.DARK_RED, Color.DARK_RED);
def rewTop = if tradeActive and !IsNaN(extremeLevel) then entryLevel else Double.NaN;
def rewBot = if tradeActive and !IsNaN(extremeLevel) then extremeLevel else Double.NaN;
AddCloud(rewTop, rewBot, Color.DARK_GREEN, Color.DARK_GREEN);

# ========================= SIGNAL MARKERS =======================
def lastSigBar = CompoundValue(1, if longSignal or shortSignal then BarNumber() else lastSigBar[1], Double.NaN);
def lastSigDir = CompoundValue(1, if longSignal then 1 else if shortSignal then -1 else lastSigDir[1], 0);

AddChartBubble(showSignals and longSignal, low - atrFlow * 0.4,
    (if showQualityInLabel then "BUY " + qualityLong else "BUY") +
    (if richLabels then "  Eff " + Round(efficiency * 100, 0) + "% Vol " + Round(volRatio, 1) + "x" else ""),
    Color("Bull"), no);
AddChartBubble(showSignals and shortSignal, high + atrFlow * 0.4,
    (if showQualityInLabel then "SELL " + qualityShort else "SELL") +
    (if richLabels then "  Eff " + Round(efficiency * 100, 0) + "% Vol " + Round(volRatio, 1) + "x" else ""),
    Color("Bear"), yes);

plot BuyTriangle = if showTriangles and longSignal then low else Double.NaN;
BuyTriangle.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
BuyTriangle.SetDefaultColor(Color("Bull"));
BuyTriangle.SetLineWeight(3);
plot SellTriangle = if showTriangles and shortSignal then high else Double.NaN;
SellTriangle.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
SellTriangle.SetDefaultColor(Color("Bear"));
SellTriangle.SetLineWeight(3);

# ============================ DASHBOARD =========================
def distATR = if atrFlow > 0 then AbsValue(close - flowBase) / atrFlow else 0;
def flowAge = BarNumber() - flowFlipBar;

AddLabel(showDash, "APEX FLOW: " +
    (if flowDir == 1 then "BULLISH" else if flowDir == -1 then "BEARISH" else "NEUTRAL") +
    " (" + flowAge + " bars)",
    if flowDir == 1 then Color("Bull") else if flowDir == -1 then Color("Bear") else Color.GRAY);
AddLabel(showDash, "Quality " + flowQuality + (if flowQuality >= minQuality then " ARMED" else " building"),
    if flowQuality >= minQuality then Color.WHITE else Color.GRAY);
AddLabel(showDash, "Eff " + Round(efficiency * 100, 1) + "%  Vol " + Round(volRatio, 2) + "x  Body " + Round(bodyPct * 100, 0) + "%", Color.LIGHT_GRAY);
AddLabel(showDash, "Stretch " + Round(distATR, 2) + "x ATR", if distATR >= 3 then Color("Bear") else Color.LIGHT_GRAY);
AddLabel(showDash, "Baseline " + Round(flowBase, 2) + "  Env +/-" + Round(atrFlow * envMult, 2), Color.LIGHT_GRAY);
AddLabel(showDash, "Gate: min Q " + minQuality + ", " + confirmCloses + " close confirm", Color.GRAY);
AddLabel(showDash and !IsNaN(lastSigBar),
    "Last: " + (if lastSigDir == 1 then "BUY" else "SELL") + " " + (BarNumber() - lastSigBar) + " bars ago",
    if lastSigDir == 1 then Color("Bull") else Color("Bear"));
AddLabel(showDash,
    if tradeDir == 1 then "LONG ACTIVE  SL " + Round(slLevel, 2)
    else if tradeDir == -1 then "SHORT ACTIVE  SL " + Round(slLevel, 2)
    else "FLAT",
    if tradeDir == 1 then Color("Bull") else if tradeDir == -1 then Color("Bear") else Color.GRAY);

# ============================= ALERTS ===========================
Alert(longSignal, "[JOAT] Apex Flow Engine - BUY", Alert.BAR, Sound.Ring);
Alert(shortSignal, "[JOAT] Apex Flow Engine - SELL", Alert.BAR, Sound.Ring);
Alert(flipUp, "[JOAT] Apex Flow - flow flipped BULLISH", Alert.BAR, Sound.Chimes);
Alert(flipDn, "[JOAT] Apex Flow - flow flipped BEARISH", Alert.BAR, Sound.Chimes);
