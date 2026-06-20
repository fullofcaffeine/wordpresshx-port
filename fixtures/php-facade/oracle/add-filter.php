<?php

if ( ! function_exists( 'wphx_f1_snapshot' ) ) {
	function wphx_f1_snapshot() {
		return json_encode( $GLOBALS['wphx_f1_registrations'] ?? array() );
	}
}

if ( ! function_exists( 'add_filter' ) ) {
	function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
		$GLOBALS['wphx_f1_registrations'][] = array(
			'hookName' => $hook_name,
			'priority' => $priority,
			'acceptedArgs' => $accepted_args,
			'callbackKind' => null === $callback ? 'null' : 'callable',
		);

		return true;
	}
}
