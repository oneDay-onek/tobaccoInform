/**
 * 商品监控配置
 * 每个商品定义:站点点位、名称、URL、以及该站点解析所需的额外信息
 */

export type SiteKey = 'life' | 'sp' | 'uncle';

export interface ProductConfig {
  /** 站点点位标识 */
  site: SiteKey;
  /** 商品显示名 */
  name: string;
  /** 商品页面 URL */
  url: string;
  /** 生活站专用:variant ID(从URL的 ?variant=xxx 提取) */
  variantId?: number;
}

/**
 * 监控商品列表
 * - 生活站(tobaccolifestyle.com):Shopify 站点,通过 .json API 查库存
 * - SP站(smokingpipes.com):普通HTML页面,解析页面文本判断
 */
export const PRODUCTS: ProductConfig[] = [
  // ============ 生活站 ============
  {
    site: 'life',
    name: 'FVP 250g',
    url: 'https://tobaccolifestyle.com/zh/products/%E5%A1%9E%E7%BC%AA%E5%B0%94-%E5%8A%A0%E7%BB%B4%E6%96%AF-%E6%BB%A1%E7%9A%84-%E5%BC%97%E5%90%89%E5%B0%BC%E4%BA%9A-%E7%A0%96%E7%8A%B6-250%E5%85%8B%E7%9B%92?variant=49067158765854',
    variantId: 49067158765854,
  },
  {
    site: 'life',
    name: 'FVF 250g',
    url: 'https://tobaccolifestyle.com/zh/collections/%E7%83%9F%E6%96%97%E7%83%9F%E8%8D%89/products/%E5%A1%9E%E7%BC%AA%E5%B0%94%E7%9A%84%E5%89%AF%E6%9C%AC%E5%8A%A0%E7%BB%B4%E6%96%AF-smoking-tobacco-to31459-full-%E5%BC%97%E5%90%89%E5%B0%BC%E4%BA%9A-%E5%88%87%E7%89%87-%E9%93%81%E7%BD%9050%E5%85%8B',
  },
  {
    site: 'life',
    name: '圣詹砖 250g',
    url: 'https://tobaccolifestyle.com/zh/products/%E5%A1%9E%E7%BC%AA%E5%B0%94-%E5%8A%A0%E7%BB%B4%E6%96%AF-%E5%9C%A3%E8%A9%B9%E5%A7%86%E6%96%AF-%E7%A0%96%E7%8A%B6-250%E5%85%8B%E7%9B%92?variant=49067151196446',
    variantId: 49067151196446,
  },
  {
    site: 'life',
    name: '圣詹切片 250g',
    url: 'https://tobaccolifestyle.com/zh/products/%E5%A1%9E%E7%BC%AA%E5%B0%94-%E5%8A%A0%E7%BB%B4%E6%96%AF-%E5%9C%A3%E8%A9%B9%E5%A7%86%E6%96%AF-%E5%88%87%E7%89%87-250%E5%85%8B%E7%9B%92?variant=49067143463198',
    variantId: 49067143463198,
  },

  // ============ SP站 ============
  {
    site: 'sp',
    name: 'FVM 50g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/samuel-gawith/full-virginia-mixture-50g/product_id/721637',
  },
  {
    site: 'sp',
    name: 'FVP 8oz',
    url: 'https://www.smokingpipes.com/pipe-tobacco/samuel-gawith/full-virginia-plug-8oz/product_id/526528',
  },
  {
    site: 'sp',
    name: 'FVF 8oz',
    url: 'https://www.smokingpipes.com/pipe-tobacco/samuel-gawith/full-virginia-flake-8oz/product_id/526527',
  },
  {
    site: 'sp',
    name: '圣詹砖 8oz',
    url: 'https://www.smokingpipes.com/pipe-tobacco/samuel-gawith/st.-james-plug-8oz/product_id/526546',
  },
  {
    site: 'sp',
    name: '圣詹切片 8oz',
    url: 'https://www.smokingpipes.com/pipe-tobacco/samuel-gawith/st.-james-flake-8oz/product_id/526545',
  },
  {
    site: 'sp',
    name: 'FVF 50g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/samuel-gawith/full-virginia-flake-50g/product_id/1991',
  },
  {
    site: 'sp',
    name: '圣詹切片 50g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/samuel-gawith/st.-james-flake-50g/product_id/21076',
  },
  {
    site: 'sp',
    name: 'F&T小白 50g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/fribourg-treyer/cut-virginia-plug-50g/product_id/284',
  },
  {
    site: 'sp',
    name: 'F&T特殊布朗 50g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/fribourg-treyer/special-brown-flake-50g/product_id/1270',
  },
  {
    site: 'sp',
    name: 'F&T混合切 50g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/fribourg-treyer/cut-blended-plug-50g/product_id/1249',
  },
  {
    site: 'sp',
    name: '索兰尼633 100g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/solani/virginia-flake---633-100g/product_id/4436',
  },

  // ============ Uncle站 ============
  {
    site: 'uncle',
    name: 'FVP 250g',
    url: 'https://www.pipeuncle.com/products/300',
  },
  {
    site: 'uncle',
    name: '圣詹砖 250g',
    url: 'https://www.pipeuncle.com/products/301',
  },
  {
    site: 'uncle',
    name: 'FVF 50g',
    url: 'https://www.pipeuncle.com/products/2057',
  },
  {
    site: 'uncle',
    name: '圣詹切片 50g',
    url: 'https://www.pipeuncle.com/products/2058',
  },
  {
    site: 'uncle',
    name: 'F&T小白 50g',
    url: 'https://www.pipeuncle.com/products/591',
  },
  {
    site: 'uncle',
    name: 'F&T特殊布朗 50g',
    url: 'https://www.pipeuncle.com/products/594',
  },
  {
    site: 'uncle',
    name: 'F&T混合切 50g',
    url: 'https://www.pipeuncle.com/products/593',
  },
  {
    site: 'uncle',
    name: '索兰尼633 100g',
    url: 'https://www.pipeuncle.com/products/612',
  },
  {
    site: 'uncle',
    name: '威棍子 275g',
    url: 'https://www.pipeuncle.com/products/2864',
  },
  {
    site: 'uncle',
    name: '红法软包 50g',
    url: 'https://www.pipeuncle.com/products/105',
  },

  // ============ 测试商品(用于验证通知文案) ============
  {
    site: 'sp',
    name: '彼得森小白 50g',
    url: 'https://www.smokingpipes.com/pipe-tobacco/peterson/flake-50g/product_id/346523',
  },
  {
    site: 'life',
    name: '蓝绞盘 50g',
    url: 'https://tobaccolifestyle.com/zh/collections/%E7%83%9F%E6%96%97%E7%83%9F%E8%8D%89/products/%E7%BB%9E%E7%9B%98-%E5%8E%9F%E7%89%88-%E5%88%87%E7%89%87-5-%E9%93%81%E7%BD%9050%E5%85%8B',
  },

  // ============ 生活站(追加) ============
  {
    site: 'life',
    name: '黄绞盘 50g',
    url: 'https://tobaccolifestyle.com/zh/collections/%E7%83%9F%E6%96%97%E7%83%9F%E8%8D%89/products/%E7%BB%9E%E7%9B%98-%E5%8E%9F%E7%89%88-%E5%88%87%E7%89%87-5-%E9%93%81%E7%BD%9050%E5%85%8B',
  },
];
