// content.js - 网页正文提取脚本 (使用 Readability 库)

(function() {
    'use strict';

    // 判断元素是否为标题（包括 h1-h6 和样式类似标题的 div/span）
    function isHeadingElement(el) {
        // 标准标题标签
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
            return true;
        }
        
        // 检查 div/span 是否通过样式表现为标题
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'div' || tagName === 'span' || tagName === 'p') {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            const fontWeight = parseInt(style.fontWeight) || 400;
            
            // 字体较大或字重较粗，可能是标题
            // 通常正文字体为 16px，标题一般 >= 18px (约 1.2em)
            if (fontSize >= 18 || fontWeight >= 700) {
                // 进一步验证：标题通常较短
                const textLength = el.textContent.trim().length;
                if (textLength > 0 && textLength < 150) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // 智能文本分段函数 - 将 Readability 提取的长文本拆分为适合朗读的段落
    function smartSplitText(text, isHeading = false) {
        if (!text || text.trim().length < 3) return [];

        // 清理多余空白
        text = text.replace(/\s+/g, ' ').trim();

        // 标题或短文本直接返回
        if (isHeading || text.length <= 200) {
            return [text];
        }

        let segments = [];

        // 优先按双换行符分割（最自然的段落分隔）
        if (text.includes('\n\n')) {
            segments = text.split(/\n\s*\n/).filter(s => s.trim().length > 10);
        }

        // 如果没有有效分割，尝试按句子分割
        if (segments.length <= 1) {
            // 按中文句号、问号、感叹号或英文句点分割
            segments = text.split(/(?<=[.!?。！？])\s+/);
            
            // 合并过短的句子
            const merged = [];
            let current = '';
            for (const seg of segments) {
                if ((current + ' ' + seg).length <= 250) {
                    current = current ? current + ' ' + seg : seg;
                } else {
                    if (current.trim()) merged.push(current.trim());
                    current = seg;
                }
            }
            if (current.trim()) merged.push(current.trim());
            segments = merged;
        }

        // 过滤太短的片段（但保留标题）
        return segments.filter(s => s.length > 10 || isHeading);
    }

    // 主提取函数 - 使用 Readability 库
    function extractParagraphs() {
        try {
            // 克隆文档以避免修改原页面
            const documentClone = document.cloneNode(true);
            
            // 创建 Readability 实例并解析
            const reader = new Readability(documentClone, {
                charThreshold: 100, // 最小字符数阈值
                classesToPreserve: ['highlight', 'selected'] // 保留的类名
            });
            
            const result = reader.parse();
            
            if (!result || !result.content) {
                console.warn('Readability 未能提取到正文内容');
                return [];
            }

            // 解析 HTML 内容
            const parser = new DOMParser();
            const doc = parser.parseFromString(result.content, 'text/html');
            
            const paragraphs = [];
            
            // 提取所有段落元素，包括标题
            const allElements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, dt, div, span');
            
            for (const el of allElements) {
                const text = el.textContent.trim();
                
                // 跳过空元素
                if (text.length < 3) continue;
                
                // 检查是否为标题元素
                const isHeading = isHeadingElement(el);
                
                // 标题：即使很短也保留
                if (isHeading) {
                    paragraphs.push(text);
                    continue;
                }
                
                // 非标题元素：需要足够长度
                if (text.length > 20) {
                    // 对长文本进行智能分段
                    const segments = smartSplitText(text, false);
                    paragraphs.push(...segments);
                }
            }

            // 如果没有提取到段落，尝试从标题和内容组合
            if (paragraphs.length === 0 && result.title) {
                paragraphs.push(result.title);
                const contentText = doc.body.textContent.trim();
                if (contentText.length > 50) {
                    const segments = smartSplitText(contentText, false);
                    paragraphs.push(...segments);
                }
            }

            // 去重：移除完全重复的段落
            const uniqueParagraphs = [];
            const seen = new Set();
            for (const p of paragraphs) {
                const normalized = p.toLowerCase().replace(/\s+/g, '');
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    uniqueParagraphs.push(p);
                }
            }

            console.log(`成功提取 ${uniqueParagraphs.length} 个段落`);
            return uniqueParagraphs;
            
        } catch (error) {
            console.error('使用 Readability 提取正文失败:', error);
            return [];
        }
    }

    // 将提取函数添加到全局作用域
    window.extractParagraphs = extractParagraphs;

})();
