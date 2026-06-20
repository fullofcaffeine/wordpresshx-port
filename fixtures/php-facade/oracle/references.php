<?php

if ( ! isset( $GLOBALS['wphx_f2_reference_store'] ) ) {
	$GLOBALS['wphx_f2_reference_store'] = 'seed';
}

if ( ! function_exists( 'wphx_reference_param' ) ) {
	function wphx_reference_param( &$value, $suffix = '-ref' ) {
		$value = strtoupper( $value ) . $suffix;

		return strlen( $value );
	}
}

if ( ! function_exists( 'wphx_reference_return' ) ) {
	function &wphx_reference_return() {
		return $GLOBALS['wphx_f2_reference_store'];
	}
}

if ( ! function_exists( 'wphx_reference_callback' ) ) {
	function wphx_reference_callback( $callback, &$value ) {
		$callback( $value );

		return $value;
	}
}
