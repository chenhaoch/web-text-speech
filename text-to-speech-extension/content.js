// Content script that runs on web pages

// Extract readable paragraphs from the page
function extractParagraphs() {
  const paragraphs = [];
  
  // Common content containers to prioritize
  const contentSelectors = [
    'article',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.post',
    '.article',
    'body'
  ];
  
  let contentContainer = null;
  
  // Find the best content container
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 100) {
      contentContainer = element;
      break;
    }
  }
  
  // If no specific container found, use body
  if (!contentContainer) {
    contentContainer = document.body;
  }
  
  // Extract text elements
  const textElements = contentContainer.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
  
  textElements.forEach(element => {
    const text = element.textContent.trim();
    
    // Filter out short or non-meaningful text
    if (text.length > 20 && !isLikelyNavigationOrAd(element)) {
      paragraphs.push(text);
    }
  });
  
  // If no paragraphs found, try to get any substantial text
  if (paragraphs.length === 0) {
    const allText = contentContainer.textContent.trim();
    if (allText.length > 100) {
      // Split by double newlines or other delimiters
      const splits = allText.split(/\n\n+/);
      splits.forEach(split => {
        const trimmed = split.trim();
        if (trimmed.length > 50) {
          paragraphs.push(trimmed);
        }
      });
    }
  }
  
  return paragraphs;
}

// Check if element is likely navigation, ad, or other non-content
function isLikelyNavigationOrAd(element) {
  const parent = element.closest('nav, header, footer, aside, .sidebar, .ad, .advertisement, .menu, .navigation');
  if (parent) {
    return true;
  }
  
  // Check for common ad/nav class names in the element's ancestry
  const className = (element.className || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  
  const excludedPatterns = [
    'nav', 'menu', 'sidebar', 'ad', 'advert', 'cookie', 'consent',
    'footer', 'header', 'comment', 'share', 'social', 'related'
  ];
  
  for (const pattern of excludedPatterns) {
    if (className.includes(pattern) || id.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getParagraphs') {
    const paragraphs = extractParagraphs();
    sendResponse({ paragraphs });
  }
});

// Also listen for paragraph extraction requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_PARAGRAPHS') {
    const paragraphs = extractParagraphs();
    sendResponse({ success: true, paragraphs });
  }
});
