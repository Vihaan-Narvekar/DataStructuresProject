# The Market That Broke a Tree Iteration Plan

The showcase should take a first-time visitor from one click to a controlled experiment. Build an ordinary BST and an AVL tree from rising prices, predict the cost of finding the highest price, then replay the same keys in a different order. Use the rotation that interrupts the rally to show how the AVL tree changes its shape. Keep custom prices and rotation practice available for further exploration.

## Demo inputs and expected results

Use these fixed orders for the guided lesson. Keep prices as integer cents in JavaScript and format them with `formatPrice`. Compute the displayed heights, paths, and counts through the existing tree engine. The values below serve as acceptance fixtures.

| Run | Insertion order in dollars | Final BST height | Final AVL height | BST comparisons for $107 | AVL comparisons for $107 |
| --- | --- | ---: | ---: | ---: | ---: |
| Market rally | 100, 101, 102, 103, 104, 105, 106, 107 | 7 | 3 | 8 | 4 |
| Same prices, different order | 103, 101, 105, 100, 102, 104, 106, 107 | 3 | 3 | 4 | 4 |

The rally's BST visits all eight prices in ascending order. The rally's AVL and both trees in the second run visit $103 → $105 → $106 → $107. Every visit counts as one comparison, including the match. Tree height is measured in edges.

## One-click rally and workspace layout

1. In `docs/index.html`, make **Run the rally** the primary action in the hero. Change the existing sequence disclosure to **Customize sequence** and keep paste, generate, reorder, and **Use current prices** inside it. Keep manual insertion visible. Explain the experiment in the hero with one question about how many prices each tree checks to find $107.
2. In `docs/js/app.js`, extract the shared replay setup and playback loop from the existing `start-replay` and `play` click handlers. Both the guided buttons and custom replay should use that path to cancel prior playback, reset the canvases, update controls, and load a queue. Keep custom replay step-first and guided replay autoplay. Allow `Experiment.startReplay` in `docs/js/experiment.js` to accept an explicit ordered list of parsed prices, defaulting to the current preview. Require 1–64 distinct keys before replacing the current batch. Copy the list into the batch and preserve the custom draft and order selector when starting a preset.
3. Move focus from the hero to the workspace's playback controls and bring the comparison into view when the visitor starts the rally. Show the current price, position out of eight, and playback controls above the trees. Pause after the current insertion, except at the guided imbalance described below. Keep **Step** to one insertion when there is no pending repair. Use immediate scrolling and frame changes when reduced motion is enabled.
4. In `docs/styles.css`, give the playback strip and tree canvases the strongest visual hierarchy in the workspace. Carry the existing warm BST and green AVL accents through headings, counts, and chart series. Use a distinct outline and text for active, visited, and unbalanced states. Keep the trees side by side where labels fit. On narrow displays, stack the canvases and keep the playback strip and paired search counts together above them with compact sticky behavior during the comparison.
5. Route guided transitions through the existing abortable playback controller. Treat the active run as custom, rally, or alternate. Record the current guided phase only where it changes the controls. On an accepted manual insert, custom replay, clear, or undo, discard any guided results and pending repair that depend on the old data. Refresh both views from the current model. Invalid submissions and edits to a custom sequence preview should preserve the active run. Restarting the rally starts a new pair of guided runs.

**Acceptance criteria**

- One click from a fresh page starts the eight-price rally with no form entry. Both trees receive the same unique prices and the replay shows the current position.
- Pause, Step, and Play work before and after the guided repair. Restarting or clearing during animation prevents the old run from advancing or publishing results.
- The custom generator, pasted prices, order selection and shuffle, single insert, and undo remain usable. A prepared custom sequence is still available after trying the rally.
- At a 375 px viewport, the document has no horizontal overflow. Playback controls and both counts are visible together while comparing the stacked trees. The chart and tree canvases can manage their own overflow.

## Prediction and synchronized search

1. Put the existing search form in the comparison workspace in `docs/index.html`, next to the paired count display in reading and tab order. When the rally reaches eight insertions, open the prediction fields, prefill $107, and prompt **How many comparisons will each tree make?** Keep predictions optional and start the search only on submission. Use the existing search field and validation for custom runs.
2. In `docs/js/app.js`, keep `Experiment.search` as the source of both paths. Extend `showPaths` to update the two counters on the same tick as the node highlights during searches. When one path finishes, keep that tree's final visited path and count visible while the other continues. Clear the counters when a new search begins or the active tree data changes.
3. Show labelled BST and AVL count tiles above the canvases, both visible on mobile. Reuse `renderResults` for the ordered paths, found or missing result, and prediction feedback. Show the target beside the counts. Announce the final result once through the existing status region. During reduced motion, reveal the final paths and exact counts immediately.
4. Offer the alternate replay after a completed guided search for $107. If the visitor searches for another price, show its normal result and keep the prompt to try $107. After the alternate queue completes, run the same $107 search automatically so the comparison uses the same target and measurement.

**Acceptance criteria**

- The $107 rally search starts with both counters at zero and ends at **8 BST comparisons** and **4 AVL comparisons**. Each increment corresponds to one highlighted node. The final paths match the fixture.
- Optional predictions receive individual feedback. An empty prediction is accepted. Invalid counts retain focus on the invalid field and can be corrected before search.
- A custom search for a missing price shows **Missing** and the number of nodes visited. A canceled search cannot overwrite the counts, paths, or message of a newer run.

## Replay with a different order and chart tree growth

1. Put **Replay with a different order** beside the $107 rally result. Start the exact alternate sequence with the shared replay setup. During the run, show the queued order and keep the completed rally result visible. The same eight keys and the same search target are the controls for the experiment.
2. Before replacing the rally, copy its completed height rows from `experiment.summary()` and its finished $107 search results into a small comparison record in `docs/js/app.js`. Store the order, target, heights, paths, and counts needed to render the comparison. Capture the alternate run in the same format after its search finishes. Use these read-only results for comparison because starting a replay resets the live history. Keep the record tied to this guided pair so later custom searches and edits cannot silently change it.
3. Render a results summary with one row per run showing both heights and both actual comparison counts. After both searches finish, report the observed result in one sentence. Suggested copy is **Changing the insertion order cut the BST search from 8 comparisons to 4. The AVL search took 4 comparisons in both runs.** Compose those counts from the recorded data.
4. Add an inline SVG height chart, with rendering scoped to a small module such as `docs/js/growth-view.js`. Use **Prices inserted** on the horizontal axis and **Tree height in edges** on the vertical axis. Plot the active run during insertion. After the alternate run starts, show one plot per order with a shared scale through both final heights. Use a fixed range of 1–8 inserted prices and 0–7 edges for the guided pair so axis positions do not shift. For custom runs, derive the domain from the current history and handle empty and single-point runs. Use the tree colors, distinct line styles or markers, and explicit BST and AVL labels. Provide the values through the existing accessible table pattern.
5. In `docs/js/app.js`, keep chart rendering on height-only rows during replay. Use `experiment.summary(lastSearchTarget)` for the detailed table's per-prefix search columns when needed. Keep the chart visible in the guided results and make the detailed rows expandable. Label the detailed table with its order and target so it is clear which run it describes.

**Acceptance criteria**

- The two completed runs remain visible together. The alternate run contains exactly the same keys, returns **4 comparisons in each tree**, and ends at height **3** in each tree.
- The rally BST line ends at height 7 and its AVL line at 3. Both alternate lines end at 3. The plots share the same scales, and the legend and table identify the two series even when their lines overlap.
- The height chart updates correctly after manual insert, custom replay, undo, and clear. An empty run has a readable empty state. Eight- and 64-price runs have readable axes without horizontal page overflow.

## Guided AVL repair and optional 3D preview

1. In `docs/js/app.js`, use the rotation trace from the third rally insertion ($102) to pause playback on `rotation.before`. Show **Paused for AVL repair** and label $100 as the unbalanced pivot (balance factor −2) and $101 as its right child. Offer **View the repair** and relabel **Step** as **Step through repair** while it applies only to the rotation. **Play** finishes the repair and continues the queue. The model already holds the repaired tree. Keep the pending trace in the guided playback state, consume it once, and prevent search against the temporary view. Handle the pause in both guided autoplay and manual stepping.
2. Adapt `openLab` and `renderSolution` to accept the specific trace selected by the guided flow. `experiment.challenge` only stores the most recent imbalance, so capture the first trace when it happens. Use the existing Previous and Next controls to show the before and after frames, identify the pivot and promoted node, and show the same in-order list in both frames. Looking at the trace in the dialog leaves the main workspace at the guided pause. Closing the dialog returns focus to the action that opened it. The existing practice dialog still uses `RotationPractice` for drag, keyboard buttons, undo, and retry.
3. Collect the rotation triggered by the sixth rally price ($105) for the 3D prototype. This left rotation occurs at $101. It promotes $103 and transfers the branch rooted at $102 from the left of $103 to the right of $101. The first rotation still serves as the introduction. The sixth insertion supplies a real subtree transfer to inspect.
4. Add **2D** and **3D preview** controls to the recorded solution for that sixth-insertion trace. Keep 2D as the default. Prototype the tilted view with the existing SVG and a CSS perspective transform around the tree surface, with on-screen labels or an adjacent text key. Use native buttons for a front and angled view and the same frame controls for both. Use the recorded before and after trees for node positions and edges. Highlight the pivot, promoted node, and moved branch in each frame, distinguishing them in text as well. Keep the labels, frame status, and in-order list readable on touch screens and with reduced motion. Expose the preview from the completed rally's rotation section even after the alternate run starts.
5. Try both representations on the same transfer task with four classmates. Ask each to identify the moved branch, its old and new parent, and whether the sorted order changed. Start half the group with 2D and half with 3D. Record correctness and where they hesitate. Surface the 3D preview in the showcase if more participants identify both parents correctly in 3D and the keyboard and touch checks pass. Keep the accessible 2D trace as the primary lesson in either case.

**Acceptance criteria**

- The first rally pauses at the third price with $100 highlighted and its balance factor shown. Advancing the repair promotes $101. The BST does not rotate. Continuing the replay adds $103 next, with no duplicate insertion.
- The 3D prototype shows $102 attached to $103 before the sixth-insertion repair and to $101 afterward. Previous and Next produce the same structure in both views. The in-order list remains $100 through $105.
- Users can step, switch views, and close the dialog by keyboard. Reduced motion removes interpolated movement while preserving each frame. Rotation practice still accepts legal moves, explains invalid moves and remaining imbalance, and supports undo and retry.

## Implementation order and verification

| Milestone | Deliverable | Verify before moving on |
| --- | --- | --- |
| 1. Guided entry | Shared replay setup, hero action, workspace and playback controls | One click starts the rally. Cancel, restart, and custom replay use the same safe setup. |
| 2. Search | Prediction prompt, synchronized highlight and counters, responsive count display | Confirm 8 versus 4 on desktop and mobile. Exercise a missing target and a canceled search. |
| 3. Order comparison | Alternate replay, snapshots, paired results, height chart and table | Confirm 4 versus 4, correct chart endpoints, and persistence across the two guided runs. |
| 4. Rotations | First-imbalance pause, trace controls, 2D explanation and 3D prototype | Step from pause through completion. Verify the sixth-insertion transfer and run the classmate walkthrough. |
| 5. Release | Updated README walkthrough and rebuilt browser bundle | Pass automated tests, verify the local file and static-server entry points, and smoke-test Pages when deployed. |

- **Automated checks.** Extend `tests/experiment.test.js` to exercise the explicit replay order, verify it preserves the custom preview, and assert equal key sets, final heights, exact $107 paths, and comparison counts for both fixtures. Check that the first pause trace and the sixth-insertion transfer have the expected pivot, promoted key, parent links, and sorted traversal. Retain all existing algorithm, pricing, and standalone entry tests.
- **Browser regression.** Test the full guided flow at 1280 px, 768 px, and 375 px, including one touch viewport and a keyboard-only pass. Try pause, step, open and close the repair dialog, restart at the repair pause, clear mid-search, and start a custom run while the alternate replay is active. Check focus, count announcements, reduced motion, readable chart labels, and stale result removal. Run a custom 64-key sequence and a double rotation in the existing practice mode.
- **Classmate walkthrough.** Give the four visitors the landing page without directions before the rotation exercise. Aim for at least three to start the rally independently, complete both searches, and explain that changing the order shortened the BST search in this example. Use the points where they stall to revise labels and control placement before release.
- **Release checks.** Run `npm run build` and `npm test` from the repository root. Commit the regenerated `docs/app.bundle.js` with the source changes. Verify the full guided lesson by opening `docs/index.html` directly and by serving `docs/` over HTTP. Update `README.md` with the new guided walkthrough and keep its custom-run instructions. Repeat the smoke test on the existing GitHub Pages project URL once deployed.
