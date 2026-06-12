/* ==========================================================================
   Apex Horizon - 2D Canvas Minimap & Analog Speedometer HUD Orchestrator
   ========================================================================== */

export class HUD {
  constructor() {
    this.initDOMElements();
    this.topSpeedRecord = 0;
  }

  /**
   * Cache DOM elements once on startup to optimize main-loop execution
   */
  initDOMElements() {
    this.elSpeed = document.getElementById('speed-number');
    this.elRpmBar = document.getElementById('rpm-gauge-inner');
    this.elRpmText = document.getElementById('rpm-text');
    this.elGear = document.getElementById('gear'); // Standardised ID

    this.elCarName = document.getElementById('hud-car-name');
    this.elZoneName = document.getElementById('hud-zone-name');
    this.elCredits = document.getElementById('credits'); // Standardised ID
    this.elTimer = document.getElementById('telemetry-timer-val');

    this.elGForce = document.getElementById('telemetry-g-force');
    this.elTopSpeed = document.getElementById('topSpeed'); // Standardised ID
    this.elNotificationCenter = document.getElementById('notification-center');

    // Analog Speedometer Canvas
    this.speedometerCanvas = document.getElementById('speedometer-canvas');
    if (this.speedometerCanvas) {
      this.sCtx = this.speedometerCanvas.getContext('2d');
    }

    // Minimap Canvas
    this.minimapCanvas = document.getElementById('minimapCanvas'); // Standardised ID
    if (this.minimapCanvas) {
      this.mCtx = this.minimapCanvas.getContext('2d');
    }
  }

  /**
   * Inject a floating notification banner that self-destructs
   */
  showNotification(header, body, isGreen = false) {
    if (!this.elNotificationCenter) return;

    const banner = document.createElement('div');
    banner.className = `game-notification ${isGreen ? 'green' : ''}`;

    banner.innerHTML = `
      <span class="header">${header.toUpperCase()}</span>
      <span class="body">${body}</span>
    `;

    this.elNotificationCenter.appendChild(banner);

    // Remove element after 3 seconds
    setTimeout(() => {
      banner.remove();
    }, 3000);
  }

  /**
   * Render all dashboard gauges, draw speedometer, and redraw minimap
   * @param {CarBase} car - Player vehicle instance
   * @param {string} zoneName - Current zone label
   * @param {number} credits - Active player balance
   * @param {string} timerString - Active speed run timer
   * @param {Array} npcList - NPC positions for minimap
   */
  update(car, zoneName, credits, timerString, npcList = []) {
    if (!car) return;

    const speed = Math.round(Math.abs(car.currentSpeedKmh));
    if (this.elSpeed) this.elSpeed.textContent = speed;

    // 1. Gear indicator: auto-calculate gear from speed bands (PROMPT 2)
    let gearText = "N";
    if (car.isReverse) {
      gearText = "R";
    } else {
      if (speed < 1) gearText = "N";
      else if (speed < 45) gearText = "1";
      else if (speed < 80) gearText = "2";
      else if (speed < 130) gearText = "3";
      else if (speed < 185) gearText = "4";
      else if (speed < 250) gearText = "5";
      else gearText = "6";
    }
    if (this.elGear) this.elGear.textContent = gearText;

    // 2. RPM Gauge Bar
    const rpm = Math.round(car.rpm);
    if (this.elRpmText) this.elRpmText.textContent = `${rpm} RPM`;

    if (this.elRpmBar) {
      const fraction = Math.max(0, Math.min(1.0, (rpm - 900) / 8100));
      this.elRpmBar.style.width = `${fraction * 100}%`;
    }

    // 3. Header Details
    if (this.elZoneName) this.elZoneName.textContent = zoneName;
    if (this.elCredits) this.elCredits.textContent = `💰 $${credits.toLocaleString()}`;
    if (this.elTimer) this.elTimer.textContent = timerString;

    // 4. Telemetry details
    const gForce = 0.05 + (car.slipFraction * 1.45);
    if (this.elGForce) this.elGForce.textContent = `${gForce.toFixed(2)} G`;

    // Record top speed
    if (speed > this.topSpeedRecord) {
      this.topSpeedRecord = speed;
    }
    if (this.elTopSpeed) this.elTopSpeed.textContent = `TOP: ${this.topSpeedRecord} km/h`;

    // 5. Draw Analog Speedometer needle dial
    this.drawAnalogSpeedometer(speed);

    // 6. Redraw minimap Canvas (200x200px)
    this.drawMinimap(car.chassisBody.position, car.chassisBody.quaternion, npcList);
  }

  /**
   * Draw circular dial and sweep needle based on speed
   */
  drawAnalogSpeedometer(speed) {
    if (!this.speedometerCanvas || !this.sCtx) return;

    const ctx = this.sCtx;
    const w = this.speedometerCanvas.width;
    const h = this.speedometerCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Speedometer dial configuration
    const startAngle = 0.75 * Math.PI;
    const endAngle = 2.25 * Math.PI;
    const maxDialSpeed = 280; // km/h max indicator
    const radius = w * 0.42;

    // 1. Draw dial backdrop arc
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();

    // 2. Draw dial tick marks every 20 km/h
    ctx.lineWidth = 2;
    for (let i = 0; i <= maxDialSpeed; i += 20) {
      const fraction = i / maxDialSpeed;
      const angle = startAngle + fraction * (endAngle - startAngle);

      const isMajor = i % 40 === 0;
      const tickLength = isMajor ? 8 : 4;
      ctx.strokeStyle = isMajor ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';

      const sx = cx + Math.cos(angle) * (radius - tickLength);
      const sy = cy + Math.sin(angle) * (radius - tickLength);
      const ex = cx + Math.cos(angle) * radius;
      const ey = cy + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // 3. Draw needle sweeps
    // Needle angle calculation clamped between bounds
    const speedFraction = Math.max(0, Math.min(1.0, speed / maxDialSpeed));
    const needleAngle = startAngle + speedFraction * (endAngle - startAngle);

    // Neon orange sweeping line
    ctx.strokeStyle = '#ff3c00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (radius - 5), cy + Math.sin(needleAngle) * (radius - 5));
    ctx.stroke();

    // Center pivot hub cover
    ctx.fillStyle = '#2c303f';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Draw top-down radar view onto the 200x200px minimap canvas
   */
  drawMinimap(playerPos, playerQuat, npcList) {
    if (!this.minimapCanvas || !this.mCtx) return;

    const ctx = this.mCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    // Clear background
    ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Coordinate conversions: Map global -2000m to 2000m coordinates to canvas (0, w)
    const worldToCanvas = (val) => {
      const shifted = val + 2000;
      return (shifted / 4000) * w;
    };

    // 1. Draw quadrant boundary grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Vertical center line (X=0)
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    // Horizontal center line (Z=0)
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // 2. Draw arterial freeway loops
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 3;

    // Ring highway loop (from -1000 to +1000)
    const hwX1 = worldToCanvas(-1000);
    const hwX2 = worldToCanvas(1000);
    const hwY1 = worldToCanvas(-1000);
    const hwY2 = worldToCanvas(1000);

    ctx.strokeRect(hwX1, hwY1, hwX2 - hwX1, hwY2 - hwY1);

    // 3. Draw NPC traffic cars (white dots - PROMPT 2)
    ctx.fillStyle = '#ffffff';
    npcList.forEach(npc => {
      const cx = worldToCanvas(npc.body.position.x);
      const cy = worldToCanvas(npc.body.position.z);

      ctx.beginPath();
      ctx.arc(cx, cy, 2.0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw Player (red dot/triangle - PROMPT 2)
    const px = worldToCanvas(playerPos.x);
    const py = worldToCanvas(playerPos.z);

    const qy = playerQuat.y;
    const qw = playerQuat.w;
    const yaw = 2 * Math.atan2(qy, qw); // Yaw angle

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(yaw);

    ctx.fillStyle = '#00c8ffff'; // Red player pointer (PROMPT 2)
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 5);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
