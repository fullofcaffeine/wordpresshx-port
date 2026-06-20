<?php

if ( ! defined( 'ABSPATH' ) ) {
	return 'ABSPATH_REQUIRED';
}

if ( ! function_exists( 'wphx_f6_oracle_escape' ) ) {
	function wphx_f6_oracle_escape( $value ) {
		return htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'wphx_f6_oracle_excerpt' ) ) {
	function wphx_f6_oracle_excerpt( $content, $limit ) {
		return strlen( $content ) <= $limit ? $content : substr( $content, 0, $limit ) . '...';
	}
}

$GLOBALS['wphx_f6_trace'][] = array(
	'event' => 'theme:begin',
	'postId' => $post['ID'],
);

$classes[] = 'rendered';
$post['rendered'] = true;
$GLOBALS['wp_query']['seen'][] = $post['ID'];
?>
<article id="post-<?php echo wphx_f6_oracle_escape( $post['ID'] ); ?>" class="<?php echo wphx_f6_oracle_escape( implode( ' ', $classes ) ); ?>">
	<h2><?php echo wphx_f6_oracle_escape( $post['title'] ); ?></h2>
	<?php $meta_return = include __DIR__ . '/template-parts/meta.php'; ?>
	<p class="entry-meta"><?php echo wphx_f6_oracle_escape( $meta_line ); ?></p>
	<div class="entry-summary"><?php echo wphx_f6_oracle_escape( wphx_f6_oracle_excerpt( $post['content'], 24 ) ); ?></div>
</article>
<?php
$GLOBALS['wphx_f6_trace'][] = array(
	'event' => 'theme:end',
	'postId' => $post['ID'],
	'classes' => $classes,
);

return array(
	'kind' => 'theme',
	'metaReturn' => $meta_return,
	'classCount' => count( $classes ),
	'postRendered' => $post['rendered'],
);
