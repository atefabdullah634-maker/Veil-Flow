/**
 * VeilFlow - Label Generator with Multiple Templates
 * محرك توليد الملصقات - قوالب متعددة
 */

const LabelGenerator = {
    // Current selected template (can be changed from settings)
    currentTemplate: 'classic', // classic, modernElegant, premium, minimalist, colorful

    generateSKU(category, fabric) {
        const year = new Date().getFullYear().toString().slice(-2);
        const sequence = VeilStorage.getNextSequence(category);
        const sequenceStr = sequence.toString().padStart(5, '0');
        return `${category}${year}${sequenceStr}-${fabric}`;
    },

    generateBarcode(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.id = containerId + '_canvas';
        // إضافة تنسيق لجعل الكانفس مرن داخل الحاوية
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        container.appendChild(canvas);

        try {
            JsBarcode(canvas, data, {
                format: "CODE128",
                width: 1.5, // تقليل العرض من 2 إلى 1.5 ليناسب الـ 5 سم
                height: 40,  // تقليل الارتفاع قليلاً لترك مساحة للنصوص
                displayValue: false,
                margin: 0,   // إلغاء الهوامش الداخلية للباركود
                background: "#ffffff",
                lineColor: "#000000"
            });
        } catch (error) {
            console.error('Error generating barcode:', error);
            container.innerHTML = '<div style="font-size: 8px;">خطأ</div>';
        }
    },

    createLabelHTML(product, includeBarcode = true) {
        const barcodeId = `barcode_${product.id || Math.random().toString(36).substr(2, 9)}`;
        const settings = VeilStorage.getSettings();

        // Get template from settings or use default
        const templateName = settings.labelTemplate || this.currentTemplate;

        // Get HTML from selected template
        let html = '';
        if (LabelTemplates[templateName]) {
            html = LabelTemplates[templateName](product, barcodeId, settings);
        } else {
            // Fallback to classic if template not found
            html = LabelTemplates.classic(product, barcodeId, settings);
        }

        return { html, barcodeId };
    },

    calculateFontSize(text) {
        const length = text.length;
        if (length <= 15) return 10;
        if (length <= 25) return 8;
        if (length <= 35) return 7;
        return 6;
    },

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    },

    generatePreview(product, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const labelData = this.createLabelHTML(product);

        container.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; padding: 2rem; background: #f1f5f9; border-radius: 12px; min-height: 250px;">
                <div style="transform: scale(1.5); transform-origin: center;">
                    ${labelData.html}
                </div>
            </div>
        `;

        setTimeout(() => {
            this.generateBarcode(labelData.barcodeId, product.sku);
        }, 200);
    },

    generateBulkLabels(products) {
        const printArea = document.getElementById('printArea');
        if (!printArea) return;

        const settings = VeilStorage.getSettings();
        printArea.innerHTML = '';

        const container = document.createElement('div');
        container.style.cssText = `
            padding: ${settings.marginTop}mm ${settings.marginLeft}mm ${settings.marginBottom}mm ${settings.marginRight}mm;
            display: grid;
            grid-template-columns: repeat(auto-fill, ${settings.labelWidth}cm);
            gap: 0.5cm;
        `;

        products.forEach(product => {
            const labelData = this.createLabelHTML(product);
            const labelDiv = document.createElement('div');
            labelDiv.innerHTML = labelData.html;
            container.appendChild(labelDiv.firstElementChild);
        });

        printArea.appendChild(container);

        setTimeout(() => {
            products.forEach(product => {
                const barcodeId = `barcode_${product.id}`;
                this.generateBarcode(barcodeId, product.sku);
            });

            setTimeout(() => {
                window.print();
                VeilStorage.incrementPrintCount(products.length);
            }, 500);
        }, 300);
    },

    downloadQRCode(product) {
        // Create temporary container for full label
        const tempDiv = document.createElement('div');
        tempDiv.id = 'temp-label-download';
        tempDiv.style.cssText = 'position: fixed; left: -9999px; top: -9999px; background: white;';
        document.body.appendChild(tempDiv);

        // Generate the full label
        const labelData = this.createLabelHTML(product);
        tempDiv.innerHTML = labelData.html;

        // Generate barcode
        setTimeout(() => {
            this.generateBarcode(labelData.barcodeId, product.sku);

            // Wait for barcode to render, then capture as image
            setTimeout(() => {
                const labelElement = tempDiv.querySelector('.print-label');

                // Use html2canvas if available, otherwise try canvas method
                if (typeof html2canvas !== 'undefined') {
                    html2canvas(labelElement, {
                        scale: 3, // High quality
                        backgroundColor: '#ffffff',
                        logging: false
                    }).then(canvas => {
                        const url = canvas.toDataURL('image/png');
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Label_${product.sku}.png`;
                        a.click();
                        document.body.removeChild(tempDiv);
                    }).catch(error => {
                        console.error('Error capturing label:', error);
                        // Fallback to simple method
                        this.downloadLabelFallback(product, tempDiv);
                    });
                } else {
                    // Fallback method without html2canvas
                    this.downloadLabelFallback(product, tempDiv);
                }
            }, 500);
        }, 100);
    },

    downloadLabelFallback(product, tempDiv) {
        // Simple fallback - just download the barcode with text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 500;
        canvas.height = 250;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Product name
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(product.name.substring(0, 30), 250, 40);

        // Get barcode canvas
        const barcodeCanvas = tempDiv.querySelector('canvas');
        if (barcodeCanvas) {
            ctx.drawImage(barcodeCanvas, 50, 70, 400, 100);
        }

        // SKU and Price
        ctx.fillStyle = '#64748b';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(product.sku, 50, 200);

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(product.price + ' ر.س', 450, 200);

        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `Label_${product.sku}.png`;
        a.click();

        document.body.removeChild(tempDiv);
    },

    generateSettingsPreview() {
        const container = document.getElementById('previewLabelsGrid');
        if (!container) return;

        container.innerHTML = '';
        const products = VeilStorage.getProducts().slice(0, 8);

        if (products.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #94a3b8;">لا توجد منتجات لعرضها</p>';
            return;
        }

        const settings = VeilStorage.getSettings();
        const gridDiv = document.createElement('div');
        gridDiv.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, ${settings.labelWidth}cm);
            gap: 0.5cm;
            justify-content: center;
        `;

        products.forEach(product => {
            const labelData = this.createLabelHTML(product);
            const labelDiv = document.createElement('div');
            labelDiv.innerHTML = labelData.html;
            labelDiv.style.transform = 'scale(0.6)';
            labelDiv.style.transformOrigin = 'top right';
            gridDiv.appendChild(labelDiv.firstElementChild);
        });

        container.appendChild(gridDiv);

        setTimeout(() => {
            products.forEach(product => {
                const barcodeId = `barcode_${product.id}`;
                this.generateBarcode(barcodeId, product.sku);
            });
        }, 100);
    },

    updateLivePreview(formData) {
        const previewBarcode = document.getElementById('previewBarcode');
        const productName = document.querySelector('.label-preview .product-name');
        const productPrice = document.querySelector('.label-preview .product-price');
        const skuText = document.querySelector('.label-preview .sku-text');

        if (productName) {
            productName.textContent = formData.name || 'اسم المنتج';
        }

        if (productPrice) {
            productPrice.textContent = formData.price ? `${formData.price} ر.س` : '--- ر.س';
        }

        if (formData.category && formData.fabric) {
            const sku = `${formData.category}${new Date().getFullYear().toString().slice(-2)}XXXXX-${formData.fabric}`;

            if (skuText) {
                skuText.textContent = sku;
            }

            const skuPreview = document.getElementById('skuPreview');
            if (skuPreview) {
                skuPreview.textContent = sku.replace('XXXXX', '●●●●●');
            }

            if (previewBarcode) {
                const tempSku = sku.replace('XXXXX', '00000');
                this.generateBarcode('previewBarcode', tempSku);
            }
        } else {
            if (skuText) skuText.textContent = '---';
            if (previewBarcode) {
                previewBarcode.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;"><i class="fas fa-barcode" style="font-size: 2.5rem;"></i></div>';
            }

            const skuPreview = document.getElementById('skuPreview');
            if (skuPreview) {
                skuPreview.textContent = 'سيتم التوليد تلقائياً';
            }
        }
    }
};
