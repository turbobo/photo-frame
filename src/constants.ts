// Canvas 渲染常量定义
// 集中管理所有魔法数字，提高可维护性

// ═══════════════════════════════════════════════════════
// 尺寸比例常量
// ═══════════════════════════════════════════════════════

/** 阴影模糊系数（相对于长边） */
export const SHADOW_BLUR_RATIO = 0.04

/** 阴影外扩系数（相对于 blur） */
export const SHADOW_SPREAD_RATIO = 0.4

/** 竖版照片底部额外留白比例（相对于 ref） */
export const BOTTOM_EXTRA_RATIO = 0.06

/** 拍立得底部留白倍数（相对于 sidePad） */
export const POLAROID_BOTTOM_MULTIPLIER = 4

/** Insta 模板底部留白比例（相对于 ref） */
export const INSTA_BOTTOM_EXTRA_RATIO = 0.09

/** Leica 底部栏高度比例（相对于 ref） */
export const LEICA_BAR_HEIGHT_RATIO = 0.06

/** EXIF 栏高度比例（相对于 ref） */
export const EXIF_BAR_HEIGHT_RATIO = 0.10

// ═══════════════════════════════════════════════════════
// 间距与内边距
// ═══════════════════════════════════════════════════════

/** 最小边距像素值（胶片模板等） */
export const MIN_PADDING_PX = 16

/** 最小边距比例（相对于长边） */
export const MIN_PADDING_RATIO = 0.008

/** 移动端响应式断点（px） */
export const MOBILE_BREAKPOINT = 640

/** 移动端内边距（px） */
export const MOBILE_PADDING = 12

/** PC 端内边距（px） */
export const DESKTOP_PADDING = 56

// ═══════════════════════════════════════════════════════
// 字体缩放系数
// ═══════════════════════════════════════════════════════

/** 型号文字放大系数 */
export const TITLE_FONT_SCALE = 1.15

/** 副标题缩小系数 */
export const SUBTITLE_FONT_SCALE = 0.85

/** Logo 水印大小比例（相对于字号） */
export const LOGO_WATERMARK_SCALE = 0.55

/** 边框信息字号比例（相对于 fontSize） */
export const BORDER_INFO_FONT_SCALE = 0.45

/** 参数标签缩小系数 */
export const PARAM_LABEL_SCALE = 0.7

/** 参数值放大系数 */
export const PARAM_VALUE_SCALE = 1.2

/** 镜头文字缩小系数 */
export const LENS_TEXT_SCALE = 0.85

// ═══════════════════════════════════════════════════════
// 透明度与颜色
// ═══════════════════════════════════════════════════════

/** 半透明 Alpha 值（通用） */
export const ALPHA_SEMI_TRANSPARENT = 0.55

/** 弱文本 Alpha 值 */
export const ALPHA_WEAK_TEXT = 0.35

/** 中等强调 Alpha 值 */
export const ALPHA_MEDIUM = 0.7

/** 强强调 Alpha 值 */
export const ALPHA_STRONG = 0.85

/** 背景遮罩颜色 */
export const BG_MASK_COLOR = '#fafaf9'

/** Leica 红点颜色 */
export const LEICA_RED = '#e60012'

// ═══════════════════════════════════════════════════════
// 齿孔与胶片元素
// ═══════════════════════════════════════════════════════

/** 齿孔半径比例（相对于 padding） */
export const FILM_HOLE_RADIUS_RATIO = 0.18

/** 齿孔间距倍数（相对于 padding） */
export const FILM_HOLE_GAP_MULTIPLIER = 1.6

/** 齿孔循环最大迭代次数（安全防护） */
export const FILM_HOLE_MAX_ITERATIONS = 200

/** 齿孔白色透明度 */
export const FILM_HOLE_ALPHA = 0.85

// ═══════════════════════════════════════════════════════
// Logo 与图标
// ═══════════════════════════════════════════════════════

/** Logo 高度比例（相对于 barH） */
export const LOGO_HEIGHT_RATIO = 0.4

/** Logo 间隙比例（相对于 padX） */
export const LOGO_GAP_RATIO = 0.5

/** Logo 与文字间距比例（相对于 ref） */
export const LOGO_TEXT_GAP_RATIO = 0.015

// ═══════════════════════════════════════════════════════
// 圆角与形状
// ═══════════════════════════════════════════════════════

/** 图像圆角缩减比例（相对于 config.radius） */
export const IMAGE_CORNER_REDUCTION = 0.3

/** 分隔点半径比例（相对于 fontPx） */
export const SEPARATOR_DOT_RADIUS_RATIO = 0.08

/** 分隔点最小半径（px） */
export const SEPARATOR_DOT_MIN_RADIUS = 1.5

/** Leica 红点半径比例（相对于 barH） */
export const LEICA_DOT_RADIUS_RATIO = 0.22

/** Leica 红点水平偏移倍数（相对于 dotR） */
export const LEICA_DOT_OFFSET_X = 1.2

/** Leica 文字水平偏移倍数（相对于 dotR） */
export const LEICA_TEXT_OFFSET_X = 2.8

// ═══════════════════════════════════════════════════════
// 布局与对齐
// ═══════════════════════════════════════════════════════

/** 行间距比例（相对于 fontPx） */
export const LINE_GAP_RATIO = 0.35

/** 参数块间距比例（相对于 fontPx） */
export const BLOCK_GAP_RATIO = 2

/** 参数块最小间距比例（相对于 padX） */
export const BLOCK_MIN_GAP_RATIO = 0.4

/** 右侧内容区最大宽度余量（相对于 W） */
export const RIGHT_AREA_MARGIN_MULTIPLIER = 3

/** 垂直安全裕度系数（用于防止文字溢出） */
export const VERTICAL_SAFETY_MARGIN = 1.6

/** 水平缩放安全系数（防止文字过宽） */
export const HORIZONTAL_SHRINK_FACTOR = 0.95

// ═══════════════════════════════════════════════════════
// 背景模糊层
// ═══════════════════════════════════════════════════════

/** 背景图最大尺寸（px） */
export const MAX_BG_SIZE = 600

/** 背景图 JPEG 质量 */
export const BG_JPEG_QUALITY = 0.7

/** 背景模糊强度（px） */
export const BG_BLUR_AMOUNT = 30

/** 背景饱和度增强系数 */
export const BG_SATURATE_MULTIPLIER = 1.2

/** 背景亮度增强系数 */
export const BG_BRIGHTNESS_MULTIPLIER = 1.05

/** 背景不透明度 */
export const BG_OPACITY = 0.3

/** 背景缩放比例 */
export const BG_SCALE = 1.08

/** 背景尺寸百分比 */
export const BG_SIZE_PERCENT = '110% 110%'

// ═══════════════════════════════════════════════════════
// DPR 与设备检测
// ═══════════════════════════════════════════════════════

/** 普通设备最大 DPR */
export const MAX_DPR_NORMAL = 2

/** 高端移动设备最大 DPR */
export const MAX_DPR_HIGH_END_MOBILE = 3

// ═══════════════════════════════════════════════════════
// 批量导出限制
// ═══════════════════════════════════════════════════════

/** 批量处理最大图片数（受设备内存限制） */
export const BATCH_EXPORT_MAX_COUNT = 50
