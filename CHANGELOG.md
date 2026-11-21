# Changelog

## 0.1.0 (2026-11-21)


### Features

* add createMeetingType API with unified error body ([#19](https://github.com/Aleksandra-korza/frontend-project-386/issues/19)) ([8b83040](https://github.com/Aleksandra-korza/frontend-project-386/commit/8b830400b3667b565f0ac7761d79d8b27bb4d8a6))
* **api:** add TypeSpec contract with OpenAPI and SDK codegen ([621eb84](https://github.com/Aleksandra-korza/frontend-project-386/commit/621eb845a42e218849e7d42d4c0d575ebd6c90ff))
* booking service for guests and owner ([#16](https://github.com/Aleksandra-korza/frontend-project-386/issues/16)) ([4cf5382](https://github.com/Aleksandra-korza/frontend-project-386/commit/4cf5382025525eea54cb1a38b0cb9976fa704e27))
* choose day and time for a meeting type ([#20](https://github.com/Aleksandra-korza/frontend-project-386/issues/20)) ([67dbad6](https://github.com/Aleksandra-korza/frontend-project-386/commit/67dbad6cdea3381ba55aa4200e6278f223042a2e))
* confirm booking as a guest ([#21](https://github.com/Aleksandra-korza/frontend-project-386/issues/21)) ([7e2060b](https://github.com/Aleksandra-korza/frontend-project-386/commit/7e2060b31b4b4e4403dd337c4c18130be8684fd1))
* create bookings with atomic overlap check ([#21](https://github.com/Aleksandra-korza/frontend-project-386/issues/21)) ([dd01c94](https://github.com/Aleksandra-korza/frontend-project-386/commit/dd01c94575e37892b60288ec85ef4912ccf2fe04))
* create meeting types in owner section ([#19](https://github.com/Aleksandra-korza/frontend-project-386/issues/19)) ([d996a76](https://github.com/Aleksandra-korza/frontend-project-386/commit/d996a769fd8cb9e7e0bfdbea39d10c4507ce422d))
* docker image, ci smoke check and render blueprint ([#26](https://github.com/Aleksandra-korza/frontend-project-386/issues/26)) ([09bfe9d](https://github.com/Aleksandra-korza/frontend-project-386/commit/09bfe9de1e6a392bd512d4a15865728a895317b2))
* **frontend:** add home page with booking stub and not found page ([8a98fa5](https://github.com/Aleksandra-korza/frontend-project-386/commit/8a98fa5cda740c78f00116a19748cdcb66864bc0))
* list meeting types in booking catalog ([#17](https://github.com/Aleksandra-korza/frontend-project-386/issues/17)) ([1e9122f](https://github.com/Aleksandra-korza/frontend-project-386/commit/1e9122fabe45c7ac87d75f985eaeb19d733e0a79))
* list upcoming bookings of all types ([#22](https://github.com/Aleksandra-korza/frontend-project-386/issues/22)) ([68a5a56](https://github.com/Aleksandra-korza/frontend-project-386/commit/68a5a566862752672d889d254b18bbbcd52dcad0))
* serve frontend from fastify with spa fallback ([#27](https://github.com/Aleksandra-korza/frontend-project-386/issues/27)) ([912fbb8](https://github.com/Aleksandra-korza/frontend-project-386/commit/912fbb862afd6400cc88861e7336eba6ae91f995))
* serve meeting type and availability window ([#20](https://github.com/Aleksandra-korza/frontend-project-386/issues/20)) ([1b3218c](https://github.com/Aleksandra-korza/frontend-project-386/commit/1b3218c3ded09c936c10f74d08302822b205f020))
* show upcoming bookings in owner section ([#22](https://github.com/Aleksandra-korza/frontend-project-386/issues/22)) ([80f2c53](https://github.com/Aleksandra-korza/frontend-project-386/commit/80f2c5355a2af4cd31be5cfb12ac752655d8b7c6))


### Bug Fixes

* compare slot instants and local day with Temporal ([#21](https://github.com/Aleksandra-korza/frontend-project-386/issues/21)) ([2e61046](https://github.com/Aleksandra-korza/frontend-project-386/commit/2e610469c8074395ff347224ea5659920944f567))
* declare contract error responses on all routes ([#21](https://github.com/Aleksandra-korza/frontend-project-386/issues/21)) ([d2a882a](https://github.com/Aleksandra-korza/frontend-project-386/commit/d2a882a0f2cc3962ff02656ba286cdb68d28d91f))
* omit duration from booking success screen ([#21](https://github.com/Aleksandra-korza/frontend-project-386/issues/21)) ([05dbb36](https://github.com/Aleksandra-korza/frontend-project-386/commit/05dbb36365181b421d6a3adcfea7c10466ce37ba))
* serve frontend static only in production or with STATIC_DIR ([#27](https://github.com/Aleksandra-korza/frontend-project-386/issues/27)) ([cbdb922](https://github.com/Aleksandra-korza/frontend-project-386/commit/cbdb922a6f5e4faedae68c8150fe4bff13dc4b4f))
* show not-found text when booking type disappears ([#21](https://github.com/Aleksandra-korza/frontend-project-386/issues/21)) ([7f95774](https://github.com/Aleksandra-korza/frontend-project-386/commit/7f9577452c014d0b24196a75ddd4da324796b3e0))
* shut down server gracefully on SIGTERM and SIGINT ([#28](https://github.com/Aleksandra-korza/frontend-project-386/issues/28)) ([80193df](https://github.com/Aleksandra-korza/frontend-project-386/commit/80193dfcaa540842a1d73cf6902320c69ecba1a0))
