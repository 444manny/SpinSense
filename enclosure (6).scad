// ============================================================
// Modular sports motion sensor - enclosure and mount system
// ============================================================
// Parts:
//   case         - electronics tray with dovetail groove underneath
//   lid          - friction-fit lid with OLED window
//   wrist_mount  - strap plate with dovetail rail
//   racket_mount - handle saddle with dovetail rail + zip-tie tunnels
//   fit_test     - 10-minute print to dial in printer tolerance
//
// All component dimensions below are taken from real caliper
// measurements of the actual parts used in this build.
//
// HOW TO USE
//   1. Set `part` below, press F6 (render), then export STL (F7).
//   2. PRINT fit_test FIRST. Rail should slide into the groove
//      snugly by hand. Too tight -> raise `fit` by 0.1, re-export.
//
// PRINT SETTINGS
//   PLA or PETG, 0.2 mm layers, 3 perimeters, 20% infill.
//   Case: floor down. Lid: flat side down. Mounts: rail up.
//   No supports needed on any part.
// ============================================================

part = "assembly"; // ["case","lid","wrist_mount","racket_mount","end_clip","fit_test","assembly"]

// ---------- global ----------
fit    = 0.30;   // mating clearance; tune with fit_test
wall   = 2.0;
divth  = 1.6;    // internal divider thickness
floorh = 2.0;
inh    = 13.0;   // internal height (use 16 if header pins are soldered on)
$fn    = 64;

// ---------- component pockets (measured dimensions + clearance) ----------
bat_l = 31.5;  bat_w = 20.4;   // LiPo 31.0 x 19.7 x 7.3mm (measured)
esp_l = 25.5;  esp_w = 19.5;   // ESP32-C3: 18x22.6mm board, 24mm w/ USB-C, 4mm thick, no pins
mpu_l = 21.9;  mpu_w = 17.2;   // MPU6050: 19.9x15.2mm board, 3.4mm thick, wires
tp_l  = 27.5;  tp_w  = 16.0;   // TP4056 (HW-373): 25.5mm long incl. USB-C port, 14mm wide
usb_esp_w = 9.5;               // ESP32 USB-C notch (~9mm connector width)
usb_tp_w  = 9.5;               // TP4056 USB-C notch
sw_l  = 14.0;  sw_h  = 7.0;    // slide switch: 12.7mm long x 6.3mm tall body (pins excluded)

// ---------- derived interior ----------
in_l  = bat_l + divth + esp_l;   // back row: battery | ESP32
in_w  = bat_w + divth + tp_w;    // rows: back (battery/ESP) | front (TP/MPU)
out_l = in_l + 2*wall;
out_w = in_w + 2*wall;
out_h = inh + floorh;

// ---------- lid ----------
lid_th = 2.0;  lip_h = 3.0;
lid_fit = 0.10;   // separate, TIGHTER clearance for the lid press-fit (not the same as the dovetail slide-fit)
clip_fit = 0.05;  // separate, TIGHTEST clearance for the end clip - firm push in/pull out by hand, no glue, stays reusable
win_l = 26.5;  win_w = 27.0;     // OLED window: 25.3x25.9mm board, 4mm thick (pins removed)
win_x =  (in_l/2 - bat_l/2);
win_y =  (in_w/2 - bat_w/2);

// ---------- dovetail ----------
dt_len  = 40;
dt_base = 11;
dt_top  = 14.5;
dt_h    = 4.0;
pad_l   = 48;  pad_w = 22;  pad_h = 5.5;
stop_th = 2.5;

// ---------- mounts ----------
wm_l = 50; wm_w = 56; wm_th = 6;   // widened so strap slots clear the case footprint (case is 42mm wide)
strap_w  = 26;                     // sized for a 25mm hook-and-loop cinch strap
rm_l = 45; rm_w = 38; rm_th = 15;
handle_d = 30;                     // handle across flats - verify against golf/racket grip
tie_w = 6;  tie_h = 2.5;

// ============================================================
module dovetail(len, extra = 0) {
    translate([-len/2, 0, 0])
        rotate([0, 90, 0])
            linear_extrude(len)
                polygon([[-0.01,        -(dt_base/2 + extra)],
                         [-0.01,         (dt_base/2 + extra)],
                         [dt_h + extra,  (dt_top/2  + extra)],
                         [dt_h + extra, -(dt_top/2  + extra)]]);
}

module rail_with_stop(z0, stop_height) {
    translate([0, 0, z0]) rotate([180, 0, 0]) dovetail(dt_len);
    translate([dt_len/2, -12, z0])
        cube([stop_th, 24, stop_height]);
}

module rounded_plate(l, w, t, r = 4) {
    hull()
        for (x = [-l/2 + r, l/2 - r], y = [-w/2 + r, w/2 - r])
            translate([x, y, 0]) cylinder(h = t, r = r);
}

// ============================================================
module case() {
    difference() {
        union() {
            translate([-out_l/2, -out_w/2, 0])
                cube([out_l, out_w, out_h]);
            translate([-pad_l/2, -pad_w/2, -pad_h])
                cube([pad_l, pad_w, pad_h]);
        }
        translate([-in_l/2, -in_w/2, floorh])
            cube([in_l, in_w, inh + 1]);
        translate([0, 0, -pad_h]) rotate([180, 0, 0])
            dovetail(pad_l + 2, fit);
        translate([in_l/2 - esp_l/2 - usb_esp_w/2, in_w/2 - 1, floorh + 1])
            cube([usb_esp_w, wall + 2, inh + 1]);
        translate([-in_l/2 + tp_l/2 - usb_tp_w/2, -in_w/2 - wall - 1, floorh + 1])
            cube([usb_tp_w, wall + 2, inh + 1]);
        translate([-in_l/2 - wall - 1, -in_w/2 + tp_w/2 - sw_l/2, floorh + 3])
            cube([wall + 2, sw_l, sw_h]);
    }
    divh = inh - 5;
    translate([-in_l/2 + bat_l, in_w/2 - bat_w, floorh])
        cube([divth, bat_w, divh]);
    translate([-in_l/2, in_w/2 - bat_w - divth, floorh])
        cube([in_l, divth, divh]);
    translate([-in_l/2 + tp_l, -in_w/2, floorh])
        cube([divth, tp_w, divh]);
}

// ============================================================
module lid() {
    difference() {
        union() {
            translate([-out_l/2, -out_w/2, 0])
                cube([out_l, out_w, lid_th]);
            translate([-(in_l - 2*lid_fit)/2, -(in_w - 2*lid_fit)/2, lid_th])
                difference() {
                    cube([in_l - 2*lid_fit, in_w - 2*lid_fit, lip_h]);
                    translate([1.6, 1.6, -1])
                        cube([in_l - 2*lid_fit - 3.2,
                              in_w - 2*lid_fit - 3.2, lip_h + 2]);
                }
        }
        translate([win_x - win_l/2, win_y - win_w/2, -1])
            cube([win_l, win_w, lid_th + 2]);
    }
}

// ============================================================
module wrist_mount() {
    difference() {
        rounded_plate(wm_l, wm_w, wm_th);
        for (sy = [-1, 1])
            translate([-(strap_w + 2)/2, sy*(wm_w/2 - 4) - 1.75, -1])
                cube([strap_w + 2, 3.5, wm_th + 2]);
    }
    rail_with_stop(wm_th, pad_h + 3);
}

// ============================================================
module racket_mount() {
    difference() {
        translate([-rm_l/2, -rm_w/2, 0]) cube([rm_l, rm_w, rm_th]);
        translate([0, 0, -handle_d/2 + 7.5])
            rotate([0, 90, 0])
                cylinder(h = rm_l + 2, d = handle_d + 1, center = true);
        for (tx = [-14, 14])
            translate([tx - tie_w/2, -rm_w/2 - 1, rm_th - 2.5 - tie_h])
                cube([tie_w, rm_w + 2, tie_h]);
    }
    rail_with_stop(rm_th, pad_h + 3);
}

// ============================================================

// ============================================================
// end_clip: a small plug that slides into the OPEN end of the
// rail after the case is mounted, physically blocking it from
// sliding off in that direction. Print one per mount. Push it
// into the groove with a firm push - it uses its own tight
// clip_fit tolerance (not the loose sliding `fit`), so it grips
// on its own. No glue - pull the tab to remove and reuse.
// ============================================================
module end_clip() {
    clip_len = 12;
    // oversized relative to nominal so it seats tightly (clip_fit clearance)
    // in a groove that was cut oversized by `fit` for the sliding case -
    // this is a firm push/pull fit, not a slide fit, and needs no glue.
    clip_extra = fit - clip_fit;
    translate([0, 0, dt_h]) rotate([180, 0, 0]) dovetail(clip_len, clip_extra);
    // small flat tab on top for grip when inserting/removing
    translate([-clip_len/2, -6, dt_h])
        cube([clip_len, 12, 3]);
}

module fit_test() {
    translate([0, 14, 0]) {
        translate([-15, -6, 0]) cube([30, 12, 3]);
        translate([0, 0, 3]) rotate([180, 0, 0]) dovetail(24);
    }
    translate([0, -14, 0]) difference() {
        translate([-15, -10, 0]) cube([30, 20, 8]);
        translate([0, 0, 8]) dovetail(32, fit);
    }
}

// ============================================================
module assembly() {
    color("lightsteelblue") case();
    color("lightsalmon")
        translate([0, 0, out_h + 10]) rotate([180, 0, 0])
            translate([0, 0, -lid_th]) lid();
    color("palegreen") translate([0, 0, -pad_h - wm_th - 8]) wrist_mount();
}

// ============================================================
if      (part == "case")         case();
else if (part == "lid")          lid();
else if (part == "wrist_mount")  wrist_mount();
else if (part == "racket_mount") racket_mount();
else if (part == "end_clip")     end_clip();
else if (part == "fit_test")     fit_test();
else                             assembly();
