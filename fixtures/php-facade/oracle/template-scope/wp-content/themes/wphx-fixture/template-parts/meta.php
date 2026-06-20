<?php

$meta_line = 'By ' . $post['author'] . ' on ' . $post['date'];
$GLOBALS['wphx_f6_trace'][] = array(
	'event' => 'theme:meta',
	'postId' => $post['ID'],
	'meta' => $meta_line,
);

return 'meta:' . $post['ID'];
