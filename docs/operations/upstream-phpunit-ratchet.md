# Upstream PHPUnit Ratchet

WPHX-700.05 starts the upstream WordPress PHPUnit parity lane described by ADR-003.

Run:

```bash
npm run upstream:phpunit-ratchet
npm run upstream:phpunit-ratchet:check
```

To provision and execute the disposable local runtime inputs:

```bash
npm run upstream:phpunit-ratchet:provision
npm run upstream:phpunit-ratchet:provision:check
```

The provisioner creates vanilla and candidate worktrees under `build/upstream-phpunit/wphx-700-09/`, installs Composer dependencies in those disposable roots, starts the locked MySQL runtime, writes local `wp-tests-config.php` files with isolated databases, and runs the ratchet in report-only mode.

The runner compares pinned vanilla WordPress against a packaged candidate distribution for the selected database, options/cache, REST, posts/query/meta/revisions, taxonomy/term, comment, rewrite/routing, canonical, link, template, theme/theme JSON, block-template, widget, nav-menu, Customizer, HTTP/cron/mail, feed/SimplePie, oEmbed/embed, HTTPS, privacy request, media, image, upload, MIME, filesystem, blocks, style engine, HTML API, interactivity, admin common/list-table, and admin feature/AJAX PHPUnit files in `tests/upstream/phpunit/groups.json`.

Group entries may include a `filter` field. The `files` list remains the provenance and prerequisite surface, while the runner passes `--filter` instead of direct file operands. Use this for upstream test files whose filenames do not map to PHPUnit class names, such as REST API files named `rest-server.php` with classes like `Tests_REST_Server`, or hyphenated theme files such as `block-template.php` and `menu/nav-menu.php`.

The WPHX-312 scope is split into four selected groups:

- `http-cron-mail-core`: HTTP helper/transport tests, cron array/scheduling tests, and PHPMailer translation coverage.
- `feed-simplepie-core`: Atom/RSS/feed helper, `fetch_feed`, enclosure, and `WP_SimplePie_File` tests.
- `oembed-embed-core`: oEmbed provider/discovery/controller/template/filter/header tests, using a filter because upstream class names do not map cleanly from every filename.
- `https-privacy-request-core`: HTTPS canonical/detection/migration tests plus privacy request export/erasure mail and request lifecycle tests.

The WPHX-313 scope is split into four selected groups:

- `media-core`: attachment image helpers, galleries, playlist shortcode, attachment JS preparation, responsive image attributes, media shortcode behavior, and metadata-facing media helpers.
- `image-editor-metadata-core`: image dimensions, editor selection/execution, GD/Imagick editor tests, intermediate sizes, image metadata, resizing, site icon, and image size helpers.
- `upload-mime-filesystem-core`: `Tests_File` filesystem/temp/unique-file behavior plus filtered `Tests_Functions` upload, MIME, filetype, image MIME, image size, stream, and default-extension methods.
- `rest-ajax-media-core`: REST attachment controller upload/edit behavior and AJAX media image editor, crop image, parse media shortcode, and send-attachment-to-editor behavior, using a filter because the files include focused class names rather than one path-mapped class per group.

The WPHX-314 scope is split into six selected groups:

- `blocks-parser-render-core`: parser, serialization, dynamic rendering, block object/list/type registry behavior, metadata registry, registration, and block asset URL tests.
- `blocks-supports-bindings-core`: block bindings registry/source/rendering and block support serialization/style helpers for anchor, aria-label, visibility, color, border, duotone, layout, spacing, typography, shadow, dimensions, elements, position, and custom CSS.
- `blocks-hooks-patterns-core`: hooked block insertion, ignored-hook metadata, pattern/category registries, pattern resolution, and block style registry behavior.
- `style-engine-core`: style engine declarations, rules, rule store, processor, public style engine helpers, and supported block style output.
- `html-api-core`: HTML decoder, tag processor, HTML processor/tree behavior, bookmarks, serialization, semantic rules, modifiable text, comments, doctype handling, html5lib cases, and active formatting support reconstruction.
- `interactivity-api-core`: server-side interactivity API helpers, directive processing, bind/class/context/each/interactive/router/style/text directives, and public interactivity functions.

The WPHX-315 PHPUnit scope is split into four selected groups:

- `admin-screen-output-common`: current-screen setup, help tabs/options, admin notices/settings errors, meta boxes/dashboard widget helpers, and miscellaneous shared admin helpers.
- `admin-menu-plugin-common`: menu page URL behavior, top-level/submenu insertion ordering, helper wrappers, duplicate parent slug behavior, and invalid menu-position diagnostics.
- `admin-list-table-base-specializations`: `WP_List_Table` base behavior plus users, legacy user search, plugins, plugin install, and privacy request list-table specializations.
- `admin-cross-domain-list-tables`: post, comment, term, media, and theme-install list tables as admin chrome/list-table ratchets with storage, taxonomy/comment, media, and theme semantics still owned by their source domains.

The WPHX-316 PHPUnit scope is split into three selected groups:

- `admin-ajax-feature-core`: admin AJAX response, tag, inline-save, comment, and heartbeat handler tests.
- `admin-feature-plugin-dependencies`: plugin dependency admin helper tests, excluding the support base file.
- `admin-privacy-ajax-feature`: privacy export/erase AJAX handler tests, with privacy request and mail internals still owned by WPHX-312.

The WPHX-315 e2e ratchet scope is declared separately in `manifests/wp-core/wphx-315-05-admin-common-list-table-upstream-ratchets.v1.json` because the shared runner currently executes PHPUnit only. Selected upstream e2e flows are dashboard quick-draft admin chrome, edit-posts list-table empty/single/quick-edit/delete behavior, trash/restore list-table notices, and fatal-error admin notices. Until an installed admin e2e runner is wired for this domain, those flows are blocked declarations and do not claim browser/admin parity.

Required runtime inputs:

- `../wordpress-develop` at WordPress `7.0.0` commit `26b68024931348d267b70e2a29910e1320d0094f`, or `WPHX_PHPUNIT_VANILLA_ROOT`.
- `vendor/phpunit/phpunit/phpunit` inside both vanilla and candidate roots.
- `wp-tests-config.php` inside both roots, pointing at isolated throwaway databases.
- `WPHX_PHPUNIT_CANDIDATE_ROOT` pointing at the packaged candidate root.

If those inputs are missing, the runner emits a deterministic `blocked` report and does not claim upstream suite parity. When the inputs exist, it classifies each group using ADR-003 semantics:

- vanilla pass / candidate pass: parity for that group;
- vanilla pass / candidate fail: candidate regression unless owned in `tests/upstream/phpunit/known-deltas.json`;
- vanilla fail / candidate fail: environment or upstream baseline failure;
- vanilla fail / candidate pass: possible divergence to investigate.

Known deltas must include an owner and expiry before a vanilla-pass/candidate-fail result can be accepted.
