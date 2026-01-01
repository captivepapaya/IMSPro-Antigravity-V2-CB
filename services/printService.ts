
import { PrinterConfig, OrderHeader, OrderItem, InventoryItem } from '../types';
import { getSupabase } from './supabaseClient';

/**
 * Encodes text to Base64 (UTF-8 safe)
 */
const encodeBase64 = (str: string): string => {
    return btoa(unescape(encodeURIComponent(str)));
};

/**
 * Pushes a print job to the Supabase Cloud Queue.
 */
export const sendToCloudQueue = async (printerName: string, contentStr: string, jobType: 'RAW' | 'IMAGE' = 'RAW'): Promise<boolean> => {
    if (!printerName) {
        console.warn("Print skipped: Printer Name Not Configured.");
        return false;
    }

    const supabase = getSupabase();
    const contentEncoded = encodeBase64(contentStr);

    console.log(`[CloudPrint] Queuing ${jobType} job for: ${printerName}`);

    try {
        const { error } = await supabase.from('print_jobs').insert({
            printer_name: printerName,
            content: contentEncoded,
            status: 'pending',
            job_type: jobType
        });

        if (error) {
            console.error("Supabase Print Error:", error);
            alert(`Print Error: ${error.message}`);
            return false;
        }

        return true;
    } catch (e: any) {
        console.error("Print Queue Exception:", e);
        alert(`Print Queue Exception: ${e.message}`);
        return false;
    }
};

export const requestPrinterScan = async (): Promise<boolean> => {
    return await sendToCloudQueue('SYSTEM', 'GET_PRINTERS', 'RAW');
};

/**
 * PRINTS RECEIPT - 72mm THERMAL PRINTER
 * Redesigned to match the preview format with Types and Qty
 * Supports cash payment with change calculation
 */
export const printOrderReceipt = async (
    config: PrinterConfig,
    order: OrderHeader,
    items: OrderItem[],
    cashReceived?: number,
    cashChange?: number
) => {
    if (!config.receiptPrinter) return;

    // 72mm Thermal Printer - Font A: 48 characters/line
    // Specs: 300mm/s, Serial 19200, Code Page PC437
    const COL_MAX = 48;

    // Helper to center text
    const center = (str: string) => {
        const pad = Math.max(0, Math.floor((COL_MAX - str.length) / 2));
        return " ".repeat(pad) + str + "\n";
    };

    // Helper for two-column layout
    const twoCol = (left: string, right: string) => {
        const maxLeft = COL_MAX - right.length - 1;
        const leftTrimmed = left.substring(0, maxLeft);
        const padding = " ".repeat(Math.max(0, COL_MAX - leftTrimmed.length - right.length));
        return leftTrimmed + padding + right + "\n";
    };

    // Helper for dashed line
    const dash = () => "-".repeat(COL_MAX) + "\n";

    let text = "";

    // Initialize printer
    text += "\x1B\x40"; // ESC @ (reset printer)
    text += "\x1B\x61\x00"; // ESC a 0 (left align)

    // ========================================
    // 1. BUSINESS HEADER
    // ========================================
    text += "\x1B\x61\x01"; // ESC a 1 (center align)
    text += "TAX INVOICE\n";
    text += "\n";
    text += "\x1B\x61\x00"; // ESC a 0 (left align)
    text += "LIFELIKE PLANTS\n";
    text += "ABN: 55 660 744 196\n";
    text += "https://lifelikeplants.au/\n";
    text += "549 Whitehorse Road, Mitcham, VIC 3132\n";
    text += "Ph: 03-98748099\n";
    text += dash();

    // ========================================
    // 2. ORDER INFO
    // ========================================
    text += `ORDER #${order.INDEX}\n`;
    // Format time: YYYYMMDDHHMMSS -> YYYY-MM-DD HH:MM
    const dateStr = `${order.TIME.slice(0, 4)}-${order.TIME.slice(4, 6)}-${order.TIME.slice(6, 8)} ${order.TIME.slice(8, 10)}:${order.TIME.slice(10, 12)}`;
    text += `${dateStr}\n`;
    text += `Customer: ${order.ID}\n`;
    text += `Payment: ${order.PAIDBY}\n`;
    text += dash();

    // ========================================
    // 3. TYPES & QTY SUMMARY
    // ========================================
    const totalQty = items.reduce((sum, item) => sum + item.QTY, 0);
    text += twoCol(`Types: ${items.length}`, `Qty: ${totalQty}`);
    text += dash();

    // ========================================
    // 4. ITEMS LIST
    // ========================================
    items.forEach((item) => {
        // Line 1: CODE and SUBTOTAL
        text += twoCol(item.CODE, `$${item.SUBTOTAL.toFixed(2)}`);

        // Line 2: Description (indented)
        const desc = item.DESC || "-";
        if (desc.length <= COL_MAX - 2) {
            text += `  ${desc}\n`;
        } else {
            // Wrap long description
            text += `  ${desc.substring(0, COL_MAX - 2)}\n`;
        }

        // Line 3: Quantity x Price (with discount if any)
        let qtyLine = `  ${item.QTY} x $${item.PRICE.toFixed(2)}`;
        if (item.ITEMDISC > 0) {
            qtyLine += ` (Disc: $${item.ITEMDISC.toFixed(2)})`;
        }
        text += qtyLine + "\n";

        text += "\n"; // Spacing between items
    });

    text += "=".repeat(COL_MAX) + "\n";

    // ========================================
    // 5. TOTALS
    // ========================================
    text += twoCol("Subtotal:", `$${order.REFTOTAL.toFixed(2)}`);

    // System Percentage Discount (if any)
    if (order.PERCENT_DISC > 0) {
        const percentDiscAmount = order.REFTOTAL * (order.PERCENT_DISC / 100);
        text += twoCol(`Sys % Disc (${order.PERCENT_DISC}%):`, `-$${percentDiscAmount.toFixed(2)}`);
    }

    // System Dollar Discount (if any)
    if (order.DOLLAR_DISC > 0) {
        text += twoCol("Sys $ Disc:", `-$${order.DOLLAR_DISC.toFixed(2)}`);
    }

    // Total Discount (if any)
    if (order.ALLDISC > 0) {
        text += twoCol("Total Discount:", `-$${order.ALLDISC.toFixed(2)}`);
    }

    text += "-".repeat(COL_MAX) + "\n";

    // Final Total
    text += twoCol("TOTAL:", `$${order.NEEDTOPAY.toFixed(2)}`);

    // Cash Payment Details (if applicable)
    if (cashReceived && cashReceived > 0) {
        text += "\n";
        text += twoCol("Cash Received:", `$${cashReceived.toFixed(2)}`);
        text += twoCol("Change:", `$${(cashChange || 0).toFixed(2)}`);
    }

    // GST (Total / 1.1 * 0.1 = GST amount)
    const gst = (order.NEEDTOPAY / 1.1) * 0.1;
    text += twoCol("Inc GST:", `$${gst.toFixed(2)}`);

    text += "=".repeat(COL_MAX) + "\n";

    // ========================================
    // 6. FOOTER
    // ========================================
    text += "\n";
    text += "\x1B\x61\x01"; // ESC a 1 (center align)
    text += "Thank you for your business!\n";
    text += "\n";
    text += `UUID: ${order.UUID}\n`;
    text += "\n";

    // Barcode: Order ID (CODE128) - without dashes
    text += "\x1B\x61\x01"; // ESC a 1 (center align for barcode)
    // ESC/POS Barcode commands
    text += "\x1D\x68\x50"; // Barcode height: 80 dots
    text += "\x1D\x77\x02"; // Barcode width: 2
    text += "\x1D\x48\x02"; // HRI position: Below barcode
    text += "\x1D\x66\x00"; // Font for HRI: Font A

    // Print CODE128 barcode - use Order ID without dashes
    const orderIdNoDash = order.INDEX.replace(/-/g, '');
    const orderIdLen = orderIdNoDash.length;
    text += String.fromCharCode(0x1D, 0x6B, 0x49, orderIdLen);
    text += orderIdNoDash;
    text += "\n\n";

    // Test Mode indicator (already centered)
    if (order.OTN === 'Test') {
        text += "\n";
        text += center("*** TEST MODE ***");
    }

    // Reset to left align before commands
    text += "\x1B\x61\x00"; // ESC a 0 (left align)

    text += "\n\n\n\n"; // Feed for cut

    // Cut paper first (full cut)
    text += "\x1D\x56\x00"; // GS V 0 (full cut)

    // Then open cash drawer for Cash payments (RJ11 connector)
    // This ensures cut happens before drawer opens
    if (cashReceived && cashReceived > 0) {
        text += "\x1B\x70\x00\x19\xFA"; // ESC p 0 25 250 (pulse pin 2)
    }

    // Send to printer
    return await sendToCloudQueue(config.receiptPrinter, text, 'RAW');
};


// --- REAL CODE 128 IMPLEMENTATION ---

// Code 128B Pattern Table (Value 0-106)
// Represents widths of: Bar Space Bar Space Bar Space
const CODE128_PATTERNS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is Stop, note extra width)
];

// Start Code B is Index 104
const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Generates the Code 128 (Set B) pattern for a given string.
 * Returns an array of objects { type: 'bar' | 'space', width: number }
 */
export const encodeCode128B = (text: string) => {
    // 1. Calculate Checksum
    let checksum = START_CODE_B;
    const codes = [START_CODE_B];

    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i) - 32; // ASCII 32 (space) maps to Index 0
        if (code < 0 || code > 100) {
            // Fallback for non-supported chars, map to space or similar to prevent crash
            codes.push(0);
            checksum += 0 * (i + 1);
        } else {
            codes.push(code);
            checksum += code * (i + 1);
        }
    }

    codes.push(checksum % 103);
    codes.push(STOP_CODE);

    // 2. Convert codes to visual pattern
    const modules: { type: 'bar' | 'space', width: number }[] = [];

    codes.forEach(code => {
        const pattern = CODE128_PATTERNS[code];
        // Pattern string e.g., "212222" means Bar(2) Space(1) Bar(2) Space(2) Bar(2) Space(2)
        for (let i = 0; i < pattern.length; i++) {
            modules.push({
                type: i % 2 === 0 ? 'bar' : 'space',
                width: parseInt(pattern[i])
            });
        }
    });

    return modules;
};

// Helper: Draw Barcode to Canvas
const drawBarcodeOnCanvas = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number) => {
    const modules = encodeCode128B(text);
    const totalWeight = modules.reduce((acc, m) => acc + m.width, 0);
    const unitWidth = w / totalWeight;

    let currentX = x;

    // Ensure high contrast background behind barcode
    ctx.fillStyle = 'white';
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);

    modules.forEach(mod => {
        const modW = mod.width * unitWidth;
        if (mod.type === 'bar') {
            ctx.fillStyle = 'black';
            // Use Math.ceil to prevent sub-pixel anti-aliasing gaps
            ctx.fillRect(currentX, y, modW + 0.5, h);
        }
        currentX += modW;
    });
};

// --- IMAGE GENERATION (Corrected for Code 128) ---
const generateLabelImageBase64 = (item: InventoryItem): string => {
    const canvas = document.createElement('canvas');
    // 40mm x 30mm @ 10px/mm scaling for drawing = 400x300
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // White Background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';

    // Map InventoryItem to Label Data
    const data = {
        PNDesc: item.PNDesc || item.Description || "",
        HL: item.HL?.toString() || "",
        Code: item.Code || "",
        Color: item.Color || "",
        Price: item.ListPrice ? item.ListPrice.toFixed(2) : "0.00",
        SKU: item.SKU || ""
    };

    // --- DRAWING LOGIC (Using Real Barcode) ---

    // 1. PNDesc (CENTERED)
    ctx.textAlign = 'center';
    ctx.font = '32px sans-serif';
    // Center X = 200, Max Width = 360 (20px padding each side)
    ctx.fillText(data.PNDesc, 200, 10, 360);

    // 2. SKU & Color (Both left-aligned at x=20)
    ctx.textAlign = 'left';

    // Calculate Scale to match 'Variegated' width in 30px font
    ctx.font = '30px sans-serif';
    const refWidth = ctx.measureText("Variegated").width;

    ctx.font = '34px sans-serif'; // SKU font
    const skuWidth = ctx.measureText(data.SKU).width;

    const skuScale = skuWidth > 0 ? (refWidth / skuWidth) : 1;

    // Draw SKU with scaling, but maintain left alignment at x=20
    ctx.save();
    ctx.translate(20, 50);
    // Apply calculated width scale, AND global 85% reduction size
    ctx.scale(skuScale * 0.85, 0.85);
    ctx.textAlign = 'left';
    ctx.fillText(data.SKU, 0, 0);
    ctx.restore();

    // Draw Color - left-aligned at x=20
    ctx.textAlign = 'left';
    ctx.fillStyle = '#555';
    ctx.font = '30px sans-serif';
    ctx.fillText(data.Color, 20, 85);
    ctx.fillStyle = 'black';

    // 3. Price (Right + 10px = 380px)
    // Show '$' sign only for prices < 100 to prevent overlap
    const priceValue = parseFloat(data.Price);
    console.log('💰 Label Price Debug:', {
        originalPrice: data.Price,
        parsedValue: priceValue,
        showDollar: priceValue < 100
    });

    ctx.textAlign = 'right';

    if (priceValue < 100) {
        // Show $ sign for prices under 100
        ctx.font = 'bold 35px sans-serif';
        ctx.fillText('$', 220, 70);
    }

    ctx.font = 'bold 60px sans-serif';
    ctx.fillText(data.Price, 380, 60);
    ctx.textAlign = 'left';

    // 4. REAL CODE 128 BARCODE (Adjusted x=20, w=360)
    // Use the real SKU logic
    const barcodeY = 135;
    const barcodeH = 100;
    const barcodeW = 360;

    // Call the shared helper
    drawBarcodeOnCanvas(ctx, data.SKU, 20, barcodeY, barcodeW, barcodeH);

    // 5. Code & HL (Left+10px=25px, Right+10px=375px)
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(data.Code, 25, 260);

    ctx.textAlign = 'right';
    ctx.fillText(data.HL, 375, 260);

    return canvas.toDataURL('image/png').split(',')[1];
};

// --- TEST 1: LABEL TEST (IMAGE MODE) ---
export const testLabelPrint = async (config: PrinterConfig): Promise<boolean> => {
    if (!config.labelPrinter) { alert("Missing Label Printer Name"); return false; }

    // Dummy Item
    const dummyItem: InventoryItem = {
        Code: "30.536.12",
        SKU: "A78330536",
        Description: "Wandering Jew Bush",
        PNDesc: "Wandering Jew Bush",
        ListPrice: 25.00,
        HL: 50,
        Color: "Variegated",
        Category: "Test",
        Stock: 100,
        CRITICAL: false
    } as unknown as InventoryItem;

    const base64Image = generateLabelImageBase64(dummyItem);
    if (!base64Image) { alert("Failed to generate label image."); return false; }

    const payload = {
        type: 'IMAGE',
        image: base64Image,
        width: 400,
        height: 300
    };

    return await sendToCloudQueue(config.labelPrinter, JSON.stringify(payload), 'IMAGE');
};

/**
 * Prints the entire barcode queue.
 * Logic: Generates one print job per label (Sequence A A A B B)
 */
export const printBarcodeQueue = async (config: PrinterConfig, queue: InventoryItem[]): Promise<boolean> => {
    if (!config.labelPrinter) {
        alert("No Label Printer Configured");
        return false;
    }

    let successCount = 0;
    let failCount = 0;

    // Iterate through items
    for (const item of queue) {
        const qty = item.printQty || 0;
        if (qty <= 0) continue;

        // Generate Image Once per Item Type
        const base64Image = generateLabelImageBase64(item);
        if (!base64Image) {
            console.error(`Failed to generate image for ${item.Code}`);
            failCount += qty;
            continue;
        }

        const payload = {
            type: 'IMAGE',
            image: base64Image,
            width: 400,
            height: 300
        };
        const payloadStr = JSON.stringify(payload);

        // Send 'qty' times
        for (let i = 0; i < qty; i++) {
            const result = await sendToCloudQueue(config.labelPrinter, payloadStr, 'IMAGE');
            if (result) successCount++;
            else failCount++;
        }
    }

    if (failCount > 0) {
        alert(`Printed ${successCount} labels. Failed ${failCount}.`);
        return false;
    }

    return true;
};

export const testReceiptPrint = async (config: PrinterConfig): Promise<boolean> => {
    if (!config.receiptPrinter) { alert("Missing Receipt Printer Name"); return false; }

    // Create Dummy Test Order
    const dummyOrder: OrderHeader = {
        INDEX: "TEST-001",
        TIME: "20241225120000",
        ID: "TEST_USER",
        REFTOTAL: 100.00,
        ALLDISC: 10.00,
        NEEDTOPAY: 90.00,
        PAIDBY: "Card",
        PERCENT_DISC: 0,
        DOLLAR_DISC: 0,
        FINALSET: 0,
        OSTATUS: "Completed",
        IS_SYNCED: false,
        UUID: "test-uuid",
        OTN: "Test"
    };

    const dummyItems: OrderItem[] = [
        {
            INDEX: "TEST-001", TIME: "20241225120000",
            CODE: "TEST.CODE", SKU: "SKU12345",
            QTY: 2, PRICE: 50.00, ITEMDISC: 10.00, SUBTOTAL: 90.00, UUID: "test-u",
            DESC: "Test General Product", GNINDEX: "A"
        }
    ];

    await printOrderReceipt(config, dummyOrder, dummyItems);
    return true;
};

export const testWaybillPrint = async (config: PrinterConfig): Promise<boolean> => {
    if (!config.waybillPrinter) { alert("Missing Waybill Printer Name"); return false; }
    const text = "IMS WAYBILL TEST\n----------------\nA4 Printer Check\n\n\n";
    return await sendToCloudQueue(config.waybillPrinter, text, 'RAW');
};
