/**
 * 将两张 Base64 图片合并为一张图片（左右并排或上下堆叠）
 * @param image1Base64 第一张图片的 Base64（包含 data:image/...;base64, 前缀）
 * @param image2Base64 第二张图片的 Base64
 * @param layout 布局方式：'horizontal'（左右）或 'vertical'（上下）
 * @returns 合并后的 Base64 图片（只包含纯 Base64，不含前缀）
 */
export async function mergeImages(
    image1Base64: string,
    image2Base64: string,
    layout: 'horizontal' | 'vertical' = 'horizontal'
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img1 = new Image();
        const img2 = new Image();

        let img1Loaded = false;
        let img2Loaded = false;

        const checkBothLoaded = () => {
            if (!img1Loaded || !img2Loaded) return;

            try {
                // 创建 Canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Canvas context unavailable');

                if (layout === 'horizontal') {
                    // 左右并排：宽度相加，高度取最大值
                    canvas.width = img1.width + img2.width;
                    canvas.height = Math.max(img1.height, img2.height);

                    // 绘制第一张图（左侧）
                    ctx.drawImage(img1, 0, 0);
                    // 绘制第二张图（右侧）
                    ctx.drawImage(img2, img1.width, 0);
                } else {
                    // 上下堆叠：宽度取最大值，高度相加
                    canvas.width = Math.max(img1.width, img2.width);
                    canvas.height = img1.height + img2.height;

                    // 绘制第一张图（上方）
                    ctx.drawImage(img1, 0, 0);
                    // 绘制第二张图（下方）
                    ctx.drawImage(img2, 0, img1.height);
                }

                // 导出为 Base64（移除 data:image/...;base64, 前缀）
                const mergedDataURL = canvas.toDataURL('image/png', 1.0);
                const base64Only = mergedDataURL.split(',')[1];

                console.log(`✅ 图片合并成功: ${canvas.width}×${canvas.height}px`);
                resolve(base64Only);
            } catch (error) {
                reject(error);
            }
        };

        img1.onload = () => {
            img1Loaded = true;
            checkBothLoaded();
        };

        img2.onload = () => {
            img2Loaded = true;
            checkBothLoaded();
        };

        img1.onerror = () => reject(new Error('Failed to load image 1'));
        img2.onerror = () => reject(new Error('Failed to load image 2'));

        // 设置图片源
        img1.src = image1Base64;
        img2.src = image2Base64;
    });
}
