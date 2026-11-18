# The Market That Broke a Tree

## What we’re building

Build a public, single-page lesson that asks whether a rising stock price makes the highest price easier to find. Students construct an ordinary binary search tree (BST) and an AVL tree from the same inputs, predict search costs, measure actual node visits, and perform rotations on a tree they helped create. The published GitHub Pages project site will open directly to the interactive lesson.

### Student experience

| Activity | What the student does | What the app shows |
| --- | --- | --- |
| **Build** | Enter individual prices, paste a list, or generate prices from a start, increment, and count. | Two initially empty trees update from the same insertion order. Each panel shows node count and height. |
| **Change the order** | Replay the same prices in the entered, ascending, descending, or shuffled order. Step through the sequence or play and pause it. | The exact sequence and current position stay visible. Students can see how insertion order changes an ordinary BST’s shape. |
| **Predict and search** | Enter any target price, or choose the suggested deepest key in the current BST. Predict each tree’s comparison count. | Both paths highlight one visit at a time. The result shows found or missing and the measured count for each tree. |
| **Inspect and move** | Select a node to read its price, height, and balance factor. Drag it around either canvas or use the keyboard. Reset the layout when ready. | Edges follow the node. The tree’s displayed connections and search paths come from its parent-child relationships. |
| **Practice rotations** | Open the most recent imbalanced AVL insertion. Promote a child by dragging it onto the parent, or select the parent and use rotation buttons. Undo or retry. | Balance factors and links update after every move. The in-order price list lets students check what the rotation preserved. |
| **Review** | Inspect the results as the number of inserted prices grows. | A comparison table shows the two heights after each insertion and, for a selected target, the actual search costs at each prefix. |

The page opens with the question, the insertion controls, and the two canvases. A **Try a rally** action opens the generator. The guided prompts use the same controls and data as free exploration.

## Technical design

Use plain HTML, CSS, SVG, and JavaScript. Author the app as ES modules and package it as a classic browser script with `npm run build` so the lesson also runs when opened as a local file. Run the tests in Node.js with `node --test`. The static files in `docs/` are the deployable site. [Node.js test runner](https://nodejs.org/api/test.html)

```text
DEVELOPMENT_PLAN.md
README.md                  Demo link, local preview, and test instructions
package.json               Bundle and test commands
docs/
  index.html               Lesson, forms, comparison panels, and practice area
  app.bundle.js            Generated browser script
  styles.css               Layout, SVG states, and responsive styling
  .nojekyll               Serve the static files directly
  js/
    prices.js              Price parsing, formatting, and sequence generation
    trees.js               Insertion, search, traversal, heights, and rotations
    experiment.js          Run history, replay, undo, comparison, and practice state
    tree-view.js           SVG layout, selection, dragging, and frame rendering
    app.js                 Form events, playback controls, prompts, and feedback
tests/                     Algorithm, input, and experiment tests
```

A tree node stores `key`, `left`, `right`, and `height`. The key is the price in integer cents and also identifies the node within each panel. The active experiment records the accepted insertion order, both roots, the batch order and cursor when applicable, and the measured heights at each step. The SVG views own node coordinates and selection. Rotation practice owns a copy of an earlier tree and its own undo stack.

## Build sequence

### 1. Implement price input and sequence generation

- Parse nonnegative decimal prices with up to two fractional digits. Convert digits to cents and require a safe integer. Accept comma- or whitespace-separated lists and identify invalid tokens in the sequence preview. Keep the first occurrence of each key and explain skipped duplicates. Use the same price parser for insertion, generator start and increment, and search.
- Generate prices from the student’s starting value, positive increment, and positive whole-number count. Validate the final price and count before allocating the list. Derive ascending and descending orders from the unique values. Store the exact shuffled array so **Replay this order** repeats it and **Shuffle again** produces a new sample.
- Test equivalent inputs such as `10` and `10.00`, zero, malformed prices, unsupported precision, invalid generator ranges, duplicates, and sequence reordering. Keep sample values in the tests. The app computes its examples and results from the inputs.

### 2. Build and verify the two tree algorithms

- Use iterative descent to find the insertion location in either tree, recording the ancestor path. Attach the leaf and update heights from the bottom up. Height is measured in edges, with `−1` for an empty subtree and `0` for a leaf.
- For AVL insertion, use `height(left) − height(right)` to detect the first imbalance while walking upward from the new node. Apply the left-left, right-right, left-right, or right-left repair. Reconnect the returned subtree root to its parent or to the tree root. Each rotation updates the heights of the nodes it relinks.
- Share the rotation primitives with practice mode. Return the insertion path and a small trace with the pivot, balance factor, and a frame immediately before repair and after each rotation. Derive frame heights from the links in each snapshot. These snapshots let the view replay a double rotation while the main experiment holds the completed AVL tree.
- Implement one search for both trees. Return the visited keys and the outcome. Count one comparison per visited node, including a match, and end an unsuccessful search at an empty link. Use traversals to compute the in-order price list and a deepest BST key for the optional target suggestion.

### 3. Connect input, replay, and prediction to one experiment

- Route manual inserts and sequence steps through the same operation. Commit an accepted key to both trees and the history together. Record the heights, update the visible trees, and use the operation trace for playback. Show a duplicate message when the key is already present.
- Keep the source sequence available after **Clear trees**. Starting a replay clears the active trees and loads the selected order at its first key. Play advances through that same queue. Pause finishes the current insertion and prevents the next one. A manual insertion ends the active queue and continues from the currently visible trees.
- Implement **Undo insertion** by rebuilding from history with the newest accepted insertion removed. If the active batch supplied that insertion, rewind its cursor as well. Clear the current prediction and search highlights whenever the tree data changes. Give playback one controller that cancels pending timers and visual frames on reset, undo, or entry into practice.
- When a student enters a search target, compute both paths, collect the optional comparison predictions, and reveal the results on demand. Use the same target in both trees even when it is missing. Include the actual path and counts in the feedback. For the growth table, use the recorded heights and run the same search over reconstructed prefixes when a target is selected.
- Generate the rotation prompt from the latest insertion in the active run that required repair. Show its inserted key, the first unbalanced node, and the relevant balance factors. Ask what the student would do next, then offer the recorded replay and the practice copy.

### 4. Make the SVG trees interactive

- Place nodes by in-order rank across the canvas and by depth down the canvas. Draw links from the model and render nodes keyed by price so their identities persist during rotations. Use a scrollable canvas with zoom controls for deep chains. Stack the panels on a narrow screen.
- In either comparison panel, update the selected node’s coordinates as the pointer moves, translating the pointer position into SVG coordinates. Redraw the connected edges with the node. Provide **Move node** controls for keyboard users and a **Reset layout** button. Animate the recorded rotation frames with a reduced-motion option that steps directly between them.
- In practice, dropping a left child on its parent performs a right rotation, and dropping a right child on its parent performs a left rotation. Give valid drop targets a visible outline and label the action. The corresponding rotation buttons provide the same operation by keyboard. Show immediate feedback for an invalid drop or a remaining imbalance, and allow a second move for a double rotation.
- Give each node an accessible name and expose the selected key, height, and balance in text. Use text or symbols alongside color for comparisons and imbalance. Announce completed actions in a status area and verify focus is usable after a replay, reset, and return from practice.

### 5. Validate the lesson in a real browser

| Area | Evidence required before publishing |
| --- | --- |
| **Tree correctness** | Cover all four AVL cases at the root and below it. After each completed insertion, check sorted in-order keys, correct stored heights, and AVL balance at every node. Confirm that the trace includes both moves in a double rotation. |
| **Search and explanation** | Test found, missing, and empty-tree searches. An ascending or descending run of `n` distinct keys gives an ordinary BST height of `n − 1`. Searching its deepest key visits `n` nodes. Compare that measured result to the AVL path and explain the `height + 1` bound for a nonempty tree. |
| **State changes** | Exercise manual insert, paste, generate, step, play, pause, replay, and undo. Test pausing before a queued step, clearing during an animation, reusing a shuffle, and undoing a batch insertion. Confirm that both trees and the cursor agree after every action. |
| **Direct manipulation** | Test dragging and keyboard movement under zoom, edge tracking, and resetting the layout. In practice, check root and internal rotations, invalid drops, undo, and restoration of the comparison run on exit. |
| **Usability** | Test on desktop and a narrow touch viewport, using the keyboard alone and with reduced motion. Profile long sorted inputs and set one documented per-run capacity based on how much the renderer can display responsively. Verify that the interface explains the limit at entry. |
| **Student walkthrough** | Ask a student to generate a rally from their own values, predict and measure a search, replay the same keys in a different order, and carry out a rotation. Check whether they can explain why tree height matters and what remains sorted after the rotation. |

## Publish the GitHub Pages showcase

1. **Run the release candidate locally.** Run `node --test` from the repository root. Serve `docs/` with `python3 -m http.server 8000 --bind 127.0.0.1 --directory docs` and open `http://127.0.0.1:8000/`. Also serve the repository root and open `/docs/` to catch asset URLs that accidentally assume the domain root. Use relative asset paths such as `./styles.css` and `./js/app.js`.
2. **Create the project repository.** Initialize Git in the workspace and push the tested files to `main` in a public project repository. Use `the-market-that-broke-a-tree` as the proposed repository name. Add a README with the lesson’s purpose, a quick walkthrough, and local test and preview commands.
3. **Enable Pages.** In the GitHub repository, open **Settings → Pages**. Select **Deploy from a branch**, choose `main` and `/docs`, and save. GitHub uses `docs/index.html` as the entry point. Check the Pages deployment run and open **Visit site** when it succeeds. [Configure the GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [Create a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
4. **Verify the public demo.** Expect a project URL in the form `https://<owner>.github.io/the-market-that-broke-a-tree/`. Open the deployed URL in a signed-out browser and complete an insert, sequence replay, search, and practice rotation. Confirm that CSS and JavaScript modules load under the repository path and that reloading the page works. [GitHub Pages project URLs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
5. **Link the release.** Add the verified live URL to the README and the repository website field. Deliver the live demo and source repository links together. If a later release breaks the demo, revert the faulty commit on `main` and repeat the live checks after Pages redeploys.
